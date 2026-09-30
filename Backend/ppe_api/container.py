"""Builds the service graph once per app and exposes it to routes."""

from dataclasses import dataclass

from fastapi import Request

from .config import Settings
from .detection.classes import load_class_names
from .detection.detector import Detector
from .json_file import JsonFile
from .services.incidents import IncidentLog
from .services.jobs import JobRegistry
from .services.metrics import MetricsTracker, default_metrics
from .services.pipeline import DetectionPipeline
from .services.session import SessionStore, default_session_state


@dataclass
class Services:
    settings: Settings
    detector: Detector
    metrics: MetricsTracker
    incidents: IncidentLog
    sessions: SessionStore
    jobs: JobRegistry
    pipeline: DetectionPipeline

    def load_state(self) -> None:
        self.metrics.load()
        self.incidents.load()
        self.detector.load_initial(self.settings.model_path)


def build_services(settings: Settings, detector: Detector | None = None) -> Services:
    data = settings.data_dir
    detector = detector or Detector(settings.models_dir)
    metrics = MetricsTracker(JsonFile(data / "metrics.json", default_metrics))
    incidents = IncidentLog(
        JsonFile(data / "incidents.json", list), settings.incidents_dir
    )
    jobs = JobRegistry(JsonFile(data / "video_jobs.json", dict))
    pipeline = DetectionPipeline(
        detector,
        load_class_names(settings.class_names_file),
        metrics,
        incidents,
        jobs,
    )
    return Services(
        settings=settings,
        detector=detector,
        metrics=metrics,
        incidents=incidents,
        sessions=SessionStore(
            JsonFile(data / "session_state.json", default_session_state)
        ),
        jobs=jobs,
        pipeline=pipeline,
    )


def get_services(request: Request) -> Services:
    return request.app.state.services
