"""Video processing jobs. Held in memory; active jobs are mirrored to disk."""

import threading
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime

from ..json_file import JsonFile

ACTIVE_STATUSES = ("pending", "processing")


@dataclass
class VideoJob:
    video_filename: str
    video_path: str
    total_frames: int
    job_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    status: str = "pending"  # pending | processing | completed | failed
    frames_processed: int = 0
    alerts_found: int = 0
    progress_percent: float = 0
    created_at: datetime = field(default_factory=datetime.now)
    completed_at: datetime | None = None
    error_message: str | None = None

    def public(self) -> dict:
        return {
            "job_id": self.job_id,
            "status": self.status,
            "progress_percent": self.progress_percent,
            "frames_processed": self.frames_processed,
            "total_frames": self.total_frames,
            "alerts_found": self.alerts_found,
            "video_filename": self.video_filename,
            "error_message": self.error_message,
        }


class JobRegistry:
    def __init__(self, file: JsonFile):
        self._file = file
        self._lock = threading.Lock()
        self._jobs: dict[str, VideoJob] = {}

    def get(self, job_id: str) -> VideoJob | None:
        with self._lock:
            return self._jobs.get(job_id)

    def save(self, job: VideoJob) -> None:
        with self._lock:
            self._jobs[job.job_id] = job
            active = {
                k: asdict(v)
                for k, v in self._jobs.items()
                if v.status in ACTIVE_STATUSES
            }
        self._file.save(active)
