"""Incident log: confirmed violations with an annotated snapshot of the frame."""

import threading
import uuid
from datetime import datetime
from pathlib import Path

import cv2

from ..detection.analysis import draw_violation_overlay
from ..json_file import JsonFile

INCIDENT_IMAGES_URL = "/api/incidents/images"


class IncidentLog:
    def __init__(self, file: JsonFile, images_dir: Path):
        self._file = file
        self._images_dir = images_dir
        self._lock = threading.Lock()
        self._items: list[dict] = []

    def load(self) -> None:
        data = self._file.load()
        with self._lock:
            self._items = data if isinstance(data, list) else []

    def all(self) -> list[dict]:
        with self._lock:
            return list(self._items)

    def record(self, frame, detections: list[dict], missing: set[str], **source):
        """Save the annotated frame and log an incident. `source` describes its origin."""
        now = datetime.now()
        image_name = f"incident_{now.strftime('%Y%m%d_%H%M%S_%f')}.jpg"
        cv2.imwrite(
            str(self._images_dir / image_name),
            draw_violation_overlay(frame, detections),
        )
        entry = {
            "id": str(uuid.uuid4()),
            "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
            "missing_ppe": sorted(missing),
            "image_path": f"{INCIDENT_IMAGES_URL}/{image_name}",
            "image_filename": image_name,
            **source,
        }
        with self._lock:
            self._items.insert(0, entry)
            snapshot = list(self._items)
        self._file.save(snapshot)
        return entry

    def clear(self) -> None:
        with self._lock:
            self._items.clear()
        self._file.delete()
        for image in self._images_dir.glob("*.jpg"):
            image.unlink(missing_ok=True)
