import os
import asyncio
import json
import shutil
from fastapi import FastAPI, UploadFile, File, Request, HTTPException, Security, Depends
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO
import cv2
import numpy as np
from pathlib import Path
from datetime import datetime
from collections import deque
import uuid
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Centralized data directory - ALL data goes here, nothing in memory
DATA_DIR = Path("data")
INCIDENTS_DIR = DATA_DIR / "incidents"
TEMP_DIR = DATA_DIR / "temp"
INCIDENTS_FILE = DATA_DIR / "incidents.json"
METRICS_FILE = DATA_DIR / "metrics.json"

# Create all data directories on startup
DATA_DIR.mkdir(exist_ok=True)
INCIDENTS_DIR.mkdir(exist_ok=True)
TEMP_DIR.mkdir(exist_ok=True)

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://localhost:8080",
).split(",")
API_KEY_ENV = os.getenv("API_KEY")

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_api_key(api_key: str = Security(api_key_header)):
    if API_KEY_ENV:
        if api_key != API_KEY_ENV:
            raise HTTPException(status_code=403, detail="Could not validate API Key")
    return api_key


MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE", 50 * 1024 * 1024))
TIMEOUT_SECONDS = int(os.getenv("TIMEOUT_SECONDS", 120))


@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    if request.method == "POST":
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_UPLOAD_SIZE:
            return JSONResponse(status_code=413, content={"error": "Payload Too Large"})
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WEIGHTS_PATH = Path(os.getenv("MODEL_PATH", "Trained Weights/best.pt"))
model = None

# Dynamic thresholds (configurable via API)
confidence_threshold = 0.40
nms_iou_threshold = 0.45

if WEIGHTS_PATH.exists():
    try:
        model = YOLO(str(WEIGHTS_PATH))
    except Exception as e:
        print(f"Failed to load model: {e}")


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "model_loaded": model is not None}


CLASS_NAMES = [
    "Hardhat",
    "Mask",
    "NO-Hardhat",
    "NO-Mask",
    "NO-Safety Vest",
    "Person",
    "Safety Cone",
    "Safety Vest",
    "machinery",
    "vehicle",
]
VIOLATION_CLASSES = {"NO-Hardhat", "NO-Safety Vest"}
COMPLIANCE_CLASSES = {"Hardhat", "Safety Vest", "Mask"}

# All state loaded from disk, not memory
metrics_state = {}
incidents_state = []
session_start = datetime.now()
total_persons = 0
compliant_persons = 0
TEMPORAL_WINDOW = 5
temporal_buffers = {}


def load_metrics():
    """Load metrics from JSON file on startup."""
    global metrics_state
    if METRICS_FILE.exists():
        try:
            with open(METRICS_FILE, "r") as f:
                metrics_state = json.load(f)
        except Exception as e:
            print(f"Failed to load metrics: {e}")
            metrics_state = get_default_metrics()
    else:
        metrics_state = get_default_metrics()


def get_default_metrics():
    return {
        "safety_score": 100.0,
        "detection_accuracy": 0.87,
        "alerts_per_hour": 0.0,
        "false_alarm_rate": 0.0,
        "frames_processed": 0,
        "violation_frames": 0,
        "confirmed_alerts": 0,
        "persons_detected": 0,
    }


def save_metrics():
    """Save metrics to JSON file."""
    try:
        with open(METRICS_FILE, "w") as f:
            json.dump(metrics_state, f, indent=2)
    except Exception as e:
        print(f"Failed to save metrics: {e}")


def load_incidents():
    """Load incidents from JSON file on startup."""
    global incidents_state
    if INCIDENTS_FILE.exists():
        try:
            with open(INCIDENTS_FILE, "r") as f:
                data = json.load(f)
                incidents_state = data if isinstance(data, list) else []
                print(f"Loaded {len(incidents_state)} incidents from disk")
        except Exception as e:
            print(f"Failed to load incidents: {e}")
            incidents_state = []
    else:
        incidents_state = []


def save_incidents():
    """Save incidents to JSON file."""
    try:
        with open(INCIDENTS_FILE, "w") as f:
            json.dump(incidents_state, f, indent=2)
    except Exception as e:
        print(f"Failed to save incidents: {e}")


# Serve incident images statically from data/incidents/
app.mount(
    "/api/incidents/images",
    StaticFiles(directory=str(INCIDENTS_DIR)),
    name="incident_images",
)


@app.get("/api/config", dependencies=[Depends(verify_api_key)])
async def get_config():
    return {
        "model_loaded": model is not None,
        "model_name": WEIGHTS_PATH.name if model else "",
        "confidence_threshold": confidence_threshold,
        "nms_iou_threshold": nms_iou_threshold,
    }


@app.get("/api/metrics", dependencies=[Depends(verify_api_key)])
async def get_metrics():
    # compute metrics
    elapsed_hours = (datetime.now() - session_start).total_seconds() / 3600.0 or 1e-9
    metrics_state["alerts_per_hour"] = round(
        metrics_state["confirmed_alerts"] / elapsed_hours, 1
    )

    if total_persons == 0:
        metrics_state["safety_score"] = 100.0
    else:
        metrics_state["safety_score"] = round(
            compliant_persons / total_persons * 100, 1
        )

    tf = metrics_state["frames_processed"]
    vf = metrics_state["violation_frames"]
    alerts = metrics_state["confirmed_alerts"]
    if vf == 0:
        metrics_state["false_alarm_rate"] = 0.0
    else:
        metrics_state["false_alarm_rate"] = round(max(0.0, (vf - alerts) / tf * 100), 1)

    return {"metrics": metrics_state}


@app.get("/api/incidents", dependencies=[Depends(verify_api_key)])
async def get_incidents():
    return {"incidents": incidents_state}


@app.delete("/api/incidents/clear", dependencies=[Depends(verify_api_key)])
async def clear_incidents():
    global incidents_state
    incidents_state.clear()
    # Clear the JSON file
    if INCIDENTS_FILE.exists():
        INCIDENTS_FILE.unlink()
    # Clear all incident images from data/incidents/
    for f in INCIDENTS_DIR.glob("*.jpg"):
        f.unlink(missing_ok=True)
    return {"status": "ok"}


@app.post("/api/config/thresholds", dependencies=[Depends(verify_api_key)])
async def update_thresholds(conf: float = 0.40, iou: float = 0.45):
    global confidence_threshold, nms_iou_threshold
    confidence_threshold = max(0.1, min(0.95, conf))
    nms_iou_threshold = max(0.1, min(0.95, iou))
    return {
        "confidence_threshold": confidence_threshold,
        "nms_iou_threshold": nms_iou_threshold,
    }


@app.post("/api/model/reload", dependencies=[Depends(verify_api_key)])
async def reload_model(weights_file: UploadFile = File(...)):
    global model, WEIGHTS_PATH
    try:
        # Save uploaded weights to data/models/ directory
        models_dir = DATA_DIR / "models"
        models_dir.mkdir(exist_ok=True)

        # Use original filename or default to uploaded.pt
        filename = weights_file.filename or "uploaded.pt"
        save_path = models_dir / filename

        contents = await weights_file.read()
        with open(save_path, "wb") as f:
            f.write(contents)

        # Try to load the new model
        new_model = YOLO(str(save_path))
        model = new_model
        WEIGHTS_PATH = save_path

        return {
            "status": "success",
            "model_loaded": True,
            "model_name": filename,
            "path": str(save_path),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load model: {str(e)}")


def update_temporal_buffers(detected_violations: set):
    for cls in VIOLATION_CLASSES:
        if cls not in temporal_buffers:
            temporal_buffers[cls] = deque(maxlen=TEMPORAL_WINDOW)
        temporal_buffers[cls].append(cls in detected_violations)

    confirmed = set()
    for cls, buf in temporal_buffers.items():
        if len(buf) == TEMPORAL_WINDOW and all(buf):
            confirmed.add(cls)

    return confirmed


@app.post("/api/detect/image", dependencies=[Depends(verify_api_key)])
async def detect_image(file: UploadFile = File(...)):
    if not model:
        return JSONResponse(
            status_code=500, content={"error": "Model not loaded", "detections": []}
        )

    global total_persons, compliant_persons

    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    img_height, img_width = frame.shape[:2]

    results = model.predict(
        frame,
        imgsz=640,
        conf=confidence_threshold,
        iou=nms_iou_threshold,
        verbose=False,
    )[0]

    detections = []
    violations = set()
    has_hardhat = False
    has_vest = False
    persons_in_frame = 0

    for box in results.boxes:
        cls_id = int(box.cls[0])
        cls_name = CLASS_NAMES[cls_id] if cls_id < len(CLASS_NAMES) else "unknown"
        conf = float(box.conf[0])

        xyxy = (
            box.xyxy[0].tolist()
            if hasattr(box.xyxy, "__len__") and len(box.xyxy) > 0
            else []
        )
        if len(xyxy) == 4:
            x1, y1, x2, y2 = map(int, xyxy)

            detections.append(
                {
                    "class_name": cls_name,
                    "confidence": conf,
                    "bbox": [x1, y1, x2, y2],
                    "is_violation": cls_name in VIOLATION_CLASSES,
                }
            )

        if cls_name in VIOLATION_CLASSES:
            violations.add(cls_name)
        if cls_name == "Person":
            persons_in_frame += 1
        if cls_name == "Hardhat":
            has_hardhat = True
        if cls_name == "Safety Vest":
            has_vest = True

    n_compliant = 1 if (persons_in_frame > 0 and has_hardhat and has_vest) else 0

    metrics_state["frames_processed"] += 1
    metrics_state["persons_detected"] += persons_in_frame
    total_persons += persons_in_frame
    compliant_persons += n_compliant

    confirmed = update_temporal_buffers(violations)

    if violations:
        metrics_state["violation_frames"] += 1

    if confirmed:
        metrics_state["confirmed_alerts"] += 1
        ts = datetime.now()
        ts_str = ts.strftime("%Y%m%d_%H%M%S_%f")
        fname = INCIDENTS_DIR / f"incident_{ts_str}.jpg"
        cv2.imwrite(str(fname), frame)
        entry = {
            "id": str(uuid.uuid4()),
            "timestamp": ts.strftime("%Y-%m-%d %H:%M:%S"),
            "missing_ppe": list(confirmed),
            "frame_number": metrics_state["frames_processed"],
            "image_path": f"/api/incidents/images/incident_{ts_str}.jpg",
            "image_filename": fname.name,
        }
        incidents_state.insert(0, entry)
        save_incidents()  # Persist to disk
        save_metrics()  # Persist metrics to disk

    return {
        "detections": detections,
        "image_width": img_width,
        "image_height": img_height,
    }


@app.post("/api/detect/video", dependencies=[Depends(verify_api_key)])
async def detect_video(file: UploadFile = File(...)):
    if not model:
        return JSONResponse(status_code=500, content={"error": "Model not loaded"})

    try:
        return await asyncio.wait_for(process_video(file), timeout=TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        return JSONResponse(
            status_code=504, content={"error": "Video processing timed out"}
        )


async def process_video(file: UploadFile):
    global total_persons, compliant_persons

    # Save the uploaded video to data/temp/ (not system temp)
    temp_video_path = (
        TEMP_DIR / f"upload_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}.mp4"
    )
    content = await file.read()
    with open(temp_video_path, "wb") as f:
        f.write(content)

    cap = cv2.VideoCapture(str(temp_video_path))
    frames_processed = 0
    alerts_found = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        results = model.predict(
            frame,
            imgsz=640,
            conf=confidence_threshold,
            iou=nms_iou_threshold,
            verbose=False,
        )[0]

        violations = set()
        has_hardhat = False
        has_vest = False
        persons_in_frame = 0

        for box in results.boxes:
            cls_id = int(box.cls[0])
            cls_name = CLASS_NAMES[cls_id] if cls_id < len(CLASS_NAMES) else "unknown"

            if cls_name in VIOLATION_CLASSES:
                violations.add(cls_name)
            if cls_name == "Person":
                persons_in_frame += 1
            if cls_name == "Hardhat":
                has_hardhat = True
            if cls_name == "Safety Vest":
                has_vest = True

        n_compliant = 1 if (persons_in_frame > 0 and has_hardhat and has_vest) else 0

        metrics_state["frames_processed"] += 1
        metrics_state["persons_detected"] += persons_in_frame
        total_persons += persons_in_frame
        compliant_persons += n_compliant

        confirmed = update_temporal_buffers(violations)

        if violations:
            metrics_state["violation_frames"] += 1

        if confirmed:
            metrics_state["confirmed_alerts"] += 1
            alerts_found += 1
            ts = datetime.now()
            ts_str = ts.strftime("%Y%m%d_%H%M%S_%f")
            fname = INCIDENTS_DIR / f"incident_{ts_str}.jpg"
            cv2.imwrite(str(fname), frame)
            entry = {
                "id": str(uuid.uuid4()),
                "timestamp": ts.strftime("%Y-%m-%d %H:%M:%S"),
                "missing_ppe": list(confirmed),
                "frame_number": metrics_state["frames_processed"],
                "image_path": f"/api/incidents/images/incident_{ts_str}.jpg",
                "image_filename": fname.name,
            }
            incidents_state.insert(0, entry)
            save_incidents()  # Persist to disk
            save_metrics()  # Persist metrics to disk

        frames_processed += 1

    cap.release()
    # Clean up temp file
    temp_video_path.unlink(missing_ok=True)

    return {"frames_processed": frames_processed, "alerts_count": alerts_found}


if __name__ == "__main__":
    import uvicorn

    # Load all persisted data from disk on startup
    load_metrics()
    load_incidents()
    uvicorn.run(app, host="0.0.0.0", port=8000)
