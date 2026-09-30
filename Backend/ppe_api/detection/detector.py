"""Owns the YOLO model and the runtime detection thresholds."""

import logging
import shutil
import threading
from pathlib import Path

logger = logging.getLogger(__name__)

INFERENCE_SIZE = 640
THRESHOLD_RANGE = (0.1, 0.95)


def _clamp(value: float) -> float:
    low, high = THRESHOLD_RANGE
    return max(low, min(high, value))


def _load_yolo(path: Path):
    from ultralytics import YOLO  # Heavy import, deferred until a model loads.

    return YOLO(str(path))


class Detector:
    def __init__(self, models_dir: Path):
        self._models_dir = models_dir
        self._model = None
        self._lock = threading.Lock()  # YOLO predict is not thread safe.
        self.weights_path: Path | None = None
        self.confidence_threshold = 0.40
        self.nms_iou_threshold = 0.45

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def load_initial(self, weights: Path) -> None:
        """Load weights through a copy in the data folder, falling back to the original."""
        if not weights.exists():
            logger.warning("Weights not found at %s", weights)
            return
        copy = self._models_dir / "best.pt"
        try:
            if not copy.exists() or weights.stat().st_mtime > copy.stat().st_mtime:
                shutil.copy2(weights, copy)
            self.load(copy)
        except Exception:
            logger.exception("Failed to load %s; trying %s", copy, weights)
            try:
                self.load(weights)
            except Exception:
                logger.exception("Failed to load model from %s", weights)

    def load(self, path: Path) -> None:
        model = _load_yolo(path)
        with self._lock:
            self._model = model
            self.weights_path = path
        logger.info("Model loaded from %s", path)

    def set_thresholds(self, confidence: float, iou: float) -> None:
        self.confidence_threshold = _clamp(confidence)
        self.nms_iou_threshold = _clamp(iou)

    def predict(self, frame):
        with self._lock:
            return self._model.predict(
                frame,
                imgsz=INFERENCE_SIZE,
                conf=self.confidence_threshold,
                iou=self.nms_iou_threshold,
                verbose=False,
            )[0]
