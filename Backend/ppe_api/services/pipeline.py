"""Runs detection on photos and videos and feeds metrics and incidents."""

import logging
import time
from datetime import datetime

import cv2

from ..detection.analysis import FrameAnalysis, TemporalConfirmer, analyse_frame
from ..detection.detector import Detector
from .incidents import IncidentLog
from .jobs import JobRegistry, VideoJob
from .metrics import MetricsTracker

logger = logging.getLogger(__name__)

ALERT_COOLDOWN_SECONDS = 2.0
PROGRESS_EVERY_FRAMES = 30
PROGRESS_EVERY_SECONDS = 2.0
METRICS_SAVE_SECONDS = 5.0
# Progress stays below 100% until the job is marked complete.
MAX_RUNNING_PROGRESS = 95


class DetectionPipeline:
    def __init__(
        self,
        detector: Detector,
        class_names: list[str],
        metrics: MetricsTracker,
        incidents: IncidentLog,
        jobs: JobRegistry,
    ):
        self.detector = detector
        self._class_names = class_names
        self._metrics = metrics
        self._incidents = incidents
        self._jobs = jobs

    def _analyse(self, frame) -> FrameAnalysis:
        analysis = analyse_frame(self.detector.predict(frame), self._class_names)
        self._metrics.record_frame(analysis)
        return analysis

    def analyse_image(self, frame, source_filename: str) -> FrameAnalysis:
        """A single photo raises an incident straight away, without temporal confirmation."""
        analysis = self._analyse(frame)
        if analysis.violations:
            self._metrics.record_alert()
            self._incidents.record(
                frame,
                analysis.detections,
                analysis.violations,
                frame_number=None,
                is_video=False,
                source_filename=source_filename,
            )
            self._metrics.save()
        return analysis

    def process_video(self, job: VideoJob) -> None:
        """Blocking; run it off the event loop."""
        job.status = "processing"
        self._jobs.save(job)
        cap = cv2.VideoCapture(job.video_path)
        try:
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            if frame_count > 0:
                job.total_frames = frame_count
            confirmer = TemporalConfirmer()
            last_alert = last_progress = last_save = 0.0
            frame_number = 0
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                frame_number += 1
                analysis = self._analyse(frame)
                confirmed = confirmer.update(analysis.violations)
                now = time.monotonic()
                if confirmed and now - last_alert >= ALERT_COOLDOWN_SECONDS:
                    last_alert = last_save = now
                    job.alerts_found += 1
                    self._metrics.record_alert()
                    self._incidents.record(
                        frame,
                        analysis.detections,
                        confirmed,
                        frame_number=frame_number,
                        is_video=True,
                        video_filename=job.video_filename,
                    )
                    self._metrics.save()
                if (
                    frame_number % PROGRESS_EVERY_FRAMES == 0
                    or now - last_progress >= PROGRESS_EVERY_SECONDS
                ):
                    last_progress = now
                    job.frames_processed = frame_number
                    if job.total_frames > 0:
                        job.progress_percent = round(
                            min(
                                MAX_RUNNING_PROGRESS,
                                frame_number / job.total_frames * 100,
                            ),
                            1,
                        )
                    self._jobs.save(job)
                if now - last_save > METRICS_SAVE_SECONDS:
                    last_save = now
                    self._metrics.save()
            job.frames_processed = frame_number
            job.progress_percent = 100
            job.status = "completed"
            job.completed_at = datetime.now()
        except Exception as exc:
            logger.exception("Video processing failed for job %s", job.job_id)
            job.status = "failed"
            job.error_message = str(exc)
        finally:
            cap.release()
            self._metrics.save()
            self._jobs.save(job)
