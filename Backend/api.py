import os
import asyncio
import tempfile
from fastapi import FastAPI, UploadFile, File, Request, HTTPException, Security, Depends
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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


MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE", 50 * 1024 * 1024))  # default 50MB
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

# State for metrics and incidents
metrics_state = {
    "safety_score": 100.0,
    "detection_accuracy": 0.87,
    "alerts_per_hour": 0.0,
    "false_alarm_rate": 0.0,
    "frames_processed": 0,
    "violation_frames": 0,
    "confirmed_alerts": 0,
    "persons_detected": 0,
}

incidents_state = []
session_start = datetime.now()
total_persons = 0
compliant_persons = 0
TEMPORAL_WINDOW = 5
temporal_buffers = {}

INCIDENT_DIR = Path("incidents")
INCIDENT_DIR.mkdir(exist_ok=True)


@app.get("/api/config", dependencies=[Depends(verify_api_key)])
async def get_config():
    return {
        "model_loaded": model is not None,
        "model_name": WEIGHTS_PATH.name if model else "",
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


@app.post("/api/incidents/clear", dependencies=[Depends(verify_api_key)])
async def clear_incidents():
    global incidents_state
    incidents_state.clear()
    for f in INCIDENT_DIR.glob("*.jpg"):
        f.unlink(missing_ok=True)
    return {"status": "ok"}


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

    results = model.predict(frame, imgsz=640, conf=0.40, iou=0.45, verbose=False)[0]

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
        fname = INCIDENT_DIR / f"incident_{ts_str}.jpg"
        cv2.imwrite(str(fname), frame)
        entry = {
            "id": str(uuid.uuid4()),
            "timestamp": ts.strftime("%Y-%m-%d %H:%M:%S"),
            "missing_ppe": list(confirmed),
            "frame_number": metrics_state["frames_processed"],
            "image_path": str(fname),
        }
        incidents_state.insert(0, entry)

    return {"detections": detections}


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

    # Save the uploaded video temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_video:
        content = await file.read()
        temp_video.write(content)
        temp_video_path = temp_video.name

    cap = cv2.VideoCapture(temp_video_path)
    frames_processed = 0
    alerts_found = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        results = model.predict(frame, imgsz=640, conf=0.40, iou=0.45, verbose=False)[0]

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
            fname = INCIDENT_DIR / f"incident_{ts_str}.jpg"
            cv2.imwrite(str(fname), frame)
            entry = {
                "id": str(uuid.uuid4()),
                "timestamp": ts.strftime("%Y-%m-%d %H:%M:%S"),
                "missing_ppe": list(confirmed),
                "frame_number": metrics_state["frames_processed"],
                "image_path": str(fname),
            }
            incidents_state.insert(0, entry)

        frames_processed += 1

    cap.release()
    os.unlink(temp_video_path)

    return {"frames_processed": frames_processed, "alerts_count": alerts_found}
