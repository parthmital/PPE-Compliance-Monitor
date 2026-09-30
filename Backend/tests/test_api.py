import cv2
import numpy as np
from fastapi.testclient import TestClient

from ppe_api.main import create_app
from ppe_api.services.jobs import VideoJob


def jpeg() -> bytes:
    return cv2.imencode(".jpg", np.zeros((48, 64, 3), np.uint8))[1].tobytes()


def test_health_and_config(client):
    assert client.get("/api/health").json() == {
        "status": "healthy",
        "model_loaded": True,
    }
    config = client.get("/api/config").json()
    assert config["model_name"] == "fake.pt"
    assert config["temporal_window"] == 5


def test_thresholds_are_clamped(client):
    r = client.post("/api/config/thresholds?conf=2&iou=0.05")
    assert r.json() == {"confidence_threshold": 0.95, "nms_iou_threshold": 0.1}


def test_image_violation_creates_incident_and_metrics(client):
    r = client.post("/api/detect/image", files={"file": ("site.jpg", jpeg())})
    assert r.status_code == 200
    body = r.json()
    assert (body["image_width"], body["image_height"]) == (64, 48)
    assert len(body["detections"]) == 2

    incidents = client.get("/api/incidents").json()["incidents"]
    assert len(incidents) == 1
    inc = incidents[0]
    assert inc["missing_ppe"] == ["NO-Hardhat"]
    assert inc["is_video"] is False and inc["frame_number"] is None
    assert inc["source_filename"].endswith("_site.jpg.jpg")
    assert client.get(inc["image_path"]).status_code == 200

    metrics = client.get("/api/metrics").json()["metrics"]
    assert metrics["frames_processed"] == 1
    assert metrics["confirmed_alerts"] == 1
    assert metrics["safety_score"] == 0.0

    assert client.delete("/api/incidents/clear").json() == {"status": "ok"}
    assert client.get("/api/incidents").json() == {"incidents": []}


def test_unreadable_image_is_rejected(client):
    r = client.post("/api/detect/image", files={"file": ("x.jpg", b"not an image")})
    assert r.status_code == 400


def test_model_not_loaded(client, detector):
    detector.weights_path = None
    r = client.post("/api/detect/image", files={"file": ("a.jpg", jpeg())})
    assert r.status_code == 500
    assert r.json() == {"error": "Model not loaded", "detections": []}


def test_session_round_trip(client):
    assert (
        client.get("/api/session").json()["state"]["video_progress"]["job_id"] is None
    )
    client.post("/api/session", json={"config": {"is_dark_mode": False}})
    state = client.get("/api/session").json()["state"]
    assert state["config"] == {"is_dark_mode": False}
    assert "last_updated" in state
    client.delete("/api/session")
    assert client.get("/api/session").json()["state"]["config"]["is_dark_mode"] is True


def test_video_job_confirms_after_window(services, tmp_path):
    path = tmp_path / "clip.mp4"
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), 10, (64, 48))
    for _ in range(12):
        writer.write(np.zeros((48, 64, 3), np.uint8))
    writer.release()

    job = VideoJob(video_filename="clip.mp4", video_path=str(path), total_frames=0)
    services.pipeline.process_video(job)

    assert job.status == "completed" and job.progress_percent == 100
    assert job.frames_processed == 12
    assert job.alerts_found == 1  # confirmed at frame 5, then cooldown
    inc = services.incidents.all()[0]
    assert inc["frame_number"] == 5 and inc["video_filename"] == "clip.mp4"


def test_unknown_job_is_404(client):
    assert client.get("/api/detect/video/nope").status_code == 404


def test_api_key_enforced(settings, services):
    from dataclasses import replace

    keyed = replace(settings, api_key="secret")
    services.settings = keyed
    with TestClient(create_app(keyed, services)) as c:
        assert c.get("/api/health").status_code == 200
        assert c.get("/api/metrics").status_code == 403
        assert c.get("/api/metrics", headers={"X-API-Key": "secret"}).status_code == 200


def test_oversized_upload_rejected(client, settings):
    r = client.post(
        "/api/detect/image",
        headers={"content-length": str(settings.max_upload_size + 1)},
        content=b"x",
    )
    assert r.status_code == 413
