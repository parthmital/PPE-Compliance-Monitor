"""Turns raw YOLO results for one frame into detections, violations and counts."""

from collections import deque
from dataclasses import dataclass, field

import cv2

from .classes import PERSON_CLASS, REQUIRED_PPE, VIOLATION_CLASSES

# A violation must persist this many consecutive frames to become an alert.
TEMPORAL_WINDOW = 5

_RED = (0, 0, 255)
_WHITE = (255, 255, 255)
_FONT = cv2.FONT_HERSHEY_SIMPLEX


@dataclass
class FrameAnalysis:
    detections: list[dict] = field(default_factory=list)
    violations: set[str] = field(default_factory=set)
    persons: int = 0
    compliant: int = 0


def _box_xyxy(box) -> list[int] | None:
    coords = box.xyxy[0].tolist() if len(box.xyxy) > 0 else []
    return list(map(int, coords)) if len(coords) == 4 else None


def analyse_frame(results, class_names: list[str]) -> FrameAnalysis:
    analysis = FrameAnalysis()
    seen: set[str] = set()
    for box in results.boxes:
        cls_id = int(box.cls[0])
        name = class_names[cls_id] if cls_id < len(class_names) else "unknown"
        seen.add(name)
        xyxy = _box_xyxy(box)
        if xyxy:
            analysis.detections.append(
                {
                    "class_name": name,
                    "confidence": float(box.conf[0]),
                    "bbox": xyxy,
                    "is_violation": name in VIOLATION_CLASSES,
                }
            )
        if name in VIOLATION_CLASSES:
            analysis.violations.add(name)
        if name == PERSON_CLASS:
            analysis.persons += 1
    # Frame-level approximation: one compliant person if all required PPE is seen.
    if analysis.persons > 0 and all(item in seen for item in REQUIRED_PPE):
        analysis.compliant = 1
    return analysis


def draw_violation_overlay(frame, detections: list[dict]):
    """Copy of the frame with labelled red boxes around violation detections."""
    out = frame.copy()
    for det in detections:
        if not det["is_violation"]:
            continue
        x1, y1, x2, y2 = det["bbox"]
        label = det["class_name"]
        cv2.rectangle(out, (x1, y1), (x2, y2), _RED, 3)
        (w, h), _ = cv2.getTextSize(label, _FONT, 0.6, 2)
        cv2.rectangle(out, (x1, y1 - h - 10), (x1 + w, y1), _RED, -1)
        cv2.putText(out, label, (x1, y1 - 5), _FONT, 0.6, _WHITE, 2)
    return out


class TemporalConfirmer:
    """Confirms a violation once it appears in every frame of the window."""

    def __init__(self, window: int = TEMPORAL_WINDOW):
        self._buffers = {cls: deque(maxlen=window) for cls in VIOLATION_CLASSES}

    def update(self, violations: set[str]) -> set[str]:
        confirmed = set()
        for cls, buf in self._buffers.items():
            buf.append(cls in violations)
            if len(buf) == buf.maxlen and all(buf):
                confirmed.add(cls)
        return confirmed
