"""Frontend UI session state, stored as an opaque JSON document."""

from datetime import datetime

from ..json_file import JsonFile


def default_session_state() -> dict:
    return {
        "config": {
            "confidence_threshold": 0.4,
            "nms_iou_threshold": 0.45,
            "is_dark_mode": True,
        },
        "video_progress": {
            "processing": False,
            "progress": 0,
            "frames_processed": 0,
            "total_frames": 0,
            "alerts_found": 0,
            "video_filename": None,
            "job_id": None,
        },
        "detection_page": {
            "media_type": "none",
            "detections": [],
            "image_filename": None,
            "video_filename": None,
            "is_image_processing": False,
        },
        "last_updated": datetime.now().isoformat(),
    }


class SessionStore:
    def __init__(self, file: JsonFile):
        self._file = file

    def load(self) -> dict:
        return self._file.load()

    def save(self, state: dict) -> None:
        self._file.save({**state, "last_updated": datetime.now().isoformat()})

    def clear(self) -> None:
        self._file.delete()
