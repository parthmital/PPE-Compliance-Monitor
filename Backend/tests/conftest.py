from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest
from fastapi.testclient import TestClient

from ppe_api.config import load_settings
from ppe_api.container import build_services
from ppe_api.detection.classes import load_class_names
from ppe_api.detection.detector import Detector
from ppe_api.main import create_app

BACKEND_DIR = Path(__file__).resolve().parent.parent
CLASS_NAMES = load_class_names(BACKEND_DIR / "Trained Weights" / "ppe_data.yaml")


def box(name: str, bbox=(10, 10, 50, 50), conf=0.9):
    return SimpleNamespace(
        cls=np.array([CLASS_NAMES.index(name)]),
        conf=np.array([conf]),
        xyxy=np.array([bbox], dtype=float),
    )


def results(*names: str):
    return SimpleNamespace(boxes=[box(n) for n in names])


class FakeDetector(Detector):
    """Detector that returns scripted results instead of running YOLO."""

    def __init__(self, models_dir, detections=("Person", "NO-Hardhat")):
        super().__init__(models_dir)
        self.detections = detections
        self.weights_path = models_dir / "fake.pt"

    @property
    def loaded(self):
        return self.weights_path is not None

    def load_initial(self, weights):
        pass

    def predict(self, frame):
        return results(*self.detections)


@pytest.fixture
def settings(tmp_path, monkeypatch):
    monkeypatch.delenv("API_KEY", raising=False)
    return replace(load_settings(), data_dir=tmp_path / "data", api_key=None)


@pytest.fixture
def detector(settings):
    settings.ensure_dirs()
    return FakeDetector(settings.models_dir)


@pytest.fixture
def services(settings, detector):
    return build_services(settings, detector)


@pytest.fixture
def client(settings, services):
    with TestClient(create_app(settings, services)) as c:
        yield c
