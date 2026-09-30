"""Session metrics: frame counters persisted to disk, rates derived on read."""

import threading
from datetime import datetime

from ..detection.analysis import FrameAnalysis
from ..json_file import JsonFile

# Fixed validation-set accuracy reported by the dashboard.
DETECTION_ACCURACY = 0.87


def default_metrics() -> dict:
    return {
        "safety_score": 100.0,
        "detection_accuracy": DETECTION_ACCURACY,
        "alerts_per_hour": 0.0,
        "false_alarm_rate": 0.0,
        "frames_processed": 0,
        "violation_frames": 0,
        "confirmed_alerts": 0,
        "persons_detected": 0,
    }


class MetricsTracker:
    def __init__(self, file: JsonFile):
        self._file = file
        self._lock = threading.Lock()
        self._state = default_metrics()
        self._session_start = datetime.now()
        # Compliance counts cover this process only, as before.
        self._total_persons = 0
        self._compliant_persons = 0

    def load(self) -> None:
        with self._lock:
            self._state = {**default_metrics(), **self._file.load()}

    def save(self) -> None:
        with self._lock:
            snapshot = dict(self._state)
        self._file.save(snapshot)

    def record_frame(self, analysis: FrameAnalysis) -> None:
        with self._lock:
            self._state["frames_processed"] += 1
            self._state["persons_detected"] += analysis.persons
            if analysis.violations:
                self._state["violation_frames"] += 1
            self._total_persons += analysis.persons
            self._compliant_persons += analysis.compliant

    def record_alert(self) -> None:
        with self._lock:
            self._state["confirmed_alerts"] += 1

    def snapshot(self) -> dict:
        with self._lock:
            state = self._state
            hours = (datetime.now() - self._session_start).total_seconds() / 3600
            state["alerts_per_hour"] = round(
                state["confirmed_alerts"] / (hours or 1e-9), 1
            )
            state["safety_score"] = (
                round(self._compliant_persons / self._total_persons * 100, 1)
                if self._total_persons
                else 100.0
            )
            frames = state["frames_processed"]
            false_alarms = state["violation_frames"] - state["confirmed_alerts"]
            state["false_alarm_rate"] = (
                round(max(0.0, false_alarms / frames * 100), 1)
                if state["violation_frames"]
                else 0.0
            )
            return dict(state)
