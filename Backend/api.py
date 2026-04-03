import os
import asyncio
import json
import shutil
import uuid
from datetime import datetime
from collections import deque
from pathlib import Path
from typing import Optional, Dict, Any
from dataclasses import dataclass, asdict
from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Request,
    HTTPException,
    Security,
    Depends,
    BackgroundTasks,
)
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO
import cv2
import numpy as np
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Centralized data directory - ALL data goes here, nothing in memory
DATA_DIR = Path("data")
INCIDENTS_DIR = DATA_DIR / "incidents"
IMAGES_DIR = DATA_DIR / "images"  # For uploaded images
VIDEOS_DIR = DATA_DIR / "videos"  # For uploaded videos
TEMP_DIR = DATA_DIR / "temp"
INCIDENTS_FILE = DATA_DIR / "incidents.json"
METRICS_FILE = DATA_DIR / "metrics.json"
SESSION_STATE_FILE = DATA_DIR / "session_state.json"

# Create all data directories on startup
DATA_DIR.mkdir(exist_ok=True)
INCIDENTS_DIR.mkdir(exist_ok=True)
IMAGES_DIR.mkdir(exist_ok=True)
VIDEOS_DIR.mkdir(exist_ok=True)
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
TIMEOUT_SECONDS = int(os.getenv("TIMEOUT_SECONDS", 600))  # 10 minutes for long videos


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


def copy_and_load_model():
    """Copy weights to data folder if they exist, then load from there."""
    global model

    # Create data/models directory
    models_dir = DATA_DIR / "models"
    models_dir.mkdir(exist_ok=True)

    # Destination path in data folder
    data_weights_path = models_dir / "best.pt"

    # Check if weights exist at original location
    if WEIGHTS_PATH.exists():
        try:
            # Copy to data folder (preserving timestamp to avoid unnecessary copies)
            if not data_weights_path.exists() or (
                WEIGHTS_PATH.stat().st_mtime > data_weights_path.stat().st_mtime
            ):
                print(f"Copying weights from {WEIGHTS_PATH} to {data_weights_path}...")
                shutil.copy2(str(WEIGHTS_PATH), str(data_weights_path))
                print("Weights copied successfully.")
            else:
                print(f"Using existing weights at {data_weights_path}")

            # Load model from data folder copy
            print(f"Loading model from {data_weights_path}...")
            model = YOLO(str(data_weights_path))
            print("Model loaded successfully.")
        except Exception as e:
            print(f"Failed to copy/load model: {e}")
            # Fallback: try loading from original location
            try:
                print(f"Attempting to load from original location {WEIGHTS_PATH}...")
                model = YOLO(str(WEIGHTS_PATH))
                print("Model loaded from original location.")
            except Exception as e2:
                print(f"Failed to load model from original location: {e2}")
    else:
        print(f"Weights not found at {WEIGHTS_PATH}")


# Initialize model on startup
copy_and_load_model()


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


# Video processing job tracking
@dataclass
class VideoJob:
    job_id: str
    status: str  # "pending", "processing", "completed", "failed"
    video_filename: str
    video_path: str
    frames_processed: int
    total_frames: int
    alerts_found: int
    progress_percent: float
    created_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


# In-memory job storage (jobs are lost on restart, but that's okay - videos still saved)
video_jobs: Dict[str, VideoJob] = {}


def get_job_status(job_id: str) -> Optional[VideoJob]:
    return video_jobs.get(job_id)


def save_job(job: VideoJob):
    video_jobs[job.job_id] = job
    # Also persist to disk for recovery
    jobs_file = DATA_DIR / "video_jobs.json"
    try:
        jobs_data = {
            k: asdict(v)
            for k, v in video_jobs.items()
            if v.status in ["processing", "pending"]
        }
        with open(jobs_file, "w") as f:
            json.dump(jobs_data, f, indent=2, default=str)
    except Exception as e:
        print(f"Failed to save jobs: {e}")


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


def get_default_session_state():
    """Get default session state."""
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


def load_session_state():
    """Load session state from JSON file."""
    if SESSION_STATE_FILE.exists():
        try:
            with open(SESSION_STATE_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"Failed to load session state: {e}")
            return get_default_session_state()
    return get_default_session_state()


def save_session_state(state: dict):
    """Save session state to JSON file."""
    try:
        state["last_updated"] = datetime.now().isoformat()
        with open(SESSION_STATE_FILE, "w") as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        print(f"Failed to save session state: {e}")


# Serve videos statically from data/videos/
app.mount(
    "/api/videos",
    StaticFiles(directory=str(VIDEOS_DIR)),
    name="videos",
)
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


@app.get("/api/session", dependencies=[Depends(verify_api_key)])
async def get_session_state():
    """Get the full session state from disk."""
    state = load_session_state()
    return {"state": state}


@app.post("/api/session", dependencies=[Depends(verify_api_key)])
async def update_session_state(request: Request):
    """Update the full session state on disk."""
    try:
        body = await request.json()
        save_session_state(body)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Failed to save session state: {str(e)}"
        )


@app.delete("/api/session", dependencies=[Depends(verify_api_key)])
async def clear_session_state():
    """Clear the session state (reset to defaults)."""
    try:
        if SESSION_STATE_FILE.exists():
            SESSION_STATE_FILE.unlink()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to clear session state: {str(e)}"
        )


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


def draw_violation_overlay(frame, results):
    """Draw bounding boxes around violation detections on the frame."""
    overlay_frame = frame.copy()
    for box in results.boxes:
        cls_id = int(box.cls[0])
        cls_name = CLASS_NAMES[cls_id] if cls_id < len(CLASS_NAMES) else "unknown"

        # Only draw for violation classes
        if cls_name in VIOLATION_CLASSES:
            xyxy = (
                box.xyxy[0].tolist()
                if hasattr(box.xyxy, "__len__") and len(box.xyxy) > 0
                else []
            )
            if len(xyxy) == 4:
                x1, y1, x2, y2 = map(int, xyxy)
                # Draw red bounding box
                cv2.rectangle(overlay_frame, (x1, y1), (x2, y2), (0, 0, 255), 3)
                # Draw label background
                label = cls_name
                (label_w, label_h), _ = cv2.getTextSize(
                    label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2
                )
                cv2.rectangle(
                    overlay_frame,
                    (x1, y1 - label_h - 10),
                    (x1 + label_w, y1),
                    (0, 0, 255),
                    -1,
                )
                # Draw label text
                cv2.putText(
                    overlay_frame,
                    label,
                    (x1, y1 - 5),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (255, 255, 255),
                    2,
                )

    return overlay_frame


@app.post("/api/detect/image", dependencies=[Depends(verify_api_key)])
async def detect_image(file: UploadFile = File(...)):
    if not model:
        return JSONResponse(
            status_code=500, content={"error": "Model not loaded", "detections": []}
        )

    global total_persons, compliant_persons, temporal_buffers

    # Reset temporal buffers for single image uploads to prevent carryover from video processing
    temporal_buffers = {}

    # Save uploaded image to data/images/ for permanent storage
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    image_filename = f"upload_{timestamp}_{file.filename or 'image'}.jpg"
    image_path = IMAGES_DIR / image_filename
    contents = await file.read()
    with open(image_path, "wb") as f:
        f.write(contents)

    # Process the saved image
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

    # For single images, bypass temporal buffer and create incident immediately
    # For video processing, the temporal buffer logic in process_video handles this
    is_single_image = True  # We already know this is a single image upload
    if is_single_image:
        # Single images: create incident immediately if violations found
        if violations:
            metrics_state["confirmed_alerts"] += 1
            ts = datetime.now()
            ts_str = ts.strftime("%Y%m%d_%H%M%S_%f")
            fname = INCIDENTS_DIR / f"incident_{ts_str}.jpg"
            # Draw violation overlays before saving
            overlay_frame = draw_violation_overlay(frame, results)
            cv2.imwrite(str(fname), overlay_frame)
            entry = {
                "id": str(uuid.uuid4()),
                "timestamp": ts.strftime("%Y-%m-%d %H:%M:%S"),
                "missing_ppe": list(violations),
                "frame_number": None,  # Images don't have frame numbers
                "image_path": f"/api/incidents/images/incident_{ts_str}.jpg",
                "image_filename": fname.name,
                "is_video": False,  # Mark as image incident
                "source_filename": image_filename,  # Link to source image
            }
            incidents_state.insert(0, entry)
            save_incidents()  # Persist to disk
            save_metrics()  # Persist metrics to disk
    elif confirmed:
        # Video frames: only create incident when temporal buffer confirms
        metrics_state["confirmed_alerts"] += 1
        ts = datetime.now()
        ts_str = ts.strftime("%Y%m%d_%H%M%S_%f")
        fname = INCIDENTS_DIR / f"incident_{ts_str}.jpg"
        # Draw violation overlays before saving
        overlay_frame = draw_violation_overlay(frame, results)
        cv2.imwrite(str(fname), overlay_frame)
        entry = {
            "id": str(uuid.uuid4()),
            "timestamp": ts.strftime("%Y-%m-%d %H:%M:%S"),
            "missing_ppe": list(confirmed),
            "frame_number": metrics_state["frames_processed"],
            "image_path": f"/api/incidents/images/incident_{ts_str}.jpg",
            "image_filename": fname.name,
            "is_video": False,  # Mark as temporal buffer incident from image stream
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
async def detect_video(
    file: UploadFile = File(...), background_tasks: BackgroundTasks = None
):
    """Start async video processing and return job ID immediately."""
    if not model:
        return JSONResponse(status_code=500, content={"error": "Model not loaded"})

    # Save the uploaded video first
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    video_filename = f"upload_{timestamp}_{file.filename or 'video'}.mp4"
    video_path = VIDEOS_DIR / video_filename
    content = await file.read()
    with open(video_path, "wb") as f:
        f.write(content)

    # Estimate total frames
    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
    cap.release()

    if frame_count <= 0:
        # Fallback: estimate based on file size (rough heuristic)
        estimated_frames = min(int(len(content) / 50000), 30000)  # Cap at 30k frames
    else:
        estimated_frames = int(frame_count)

    # Create job
    job_id = str(uuid.uuid4())
    job = VideoJob(
        job_id=job_id,
        status="pending",
        video_filename=video_filename,
        video_path=str(video_path),
        frames_processed=0,
        total_frames=estimated_frames,
        alerts_found=0,
        progress_percent=0,
        created_at=datetime.now(),
    )
    save_job(job)

    # Start background processing
    if background_tasks:
        background_tasks.add_task(
            process_video_background, job_id, str(video_path), video_filename
        )
    else:
        # Fallback: create asyncio task
        asyncio.create_task(
            process_video_background(job_id, str(video_path), video_filename)
        )

    return {
        "job_id": job_id,
        "status": "pending",
        "message": "Video processing started",
        "estimated_frames": estimated_frames,
    }


@app.get("/api/detect/video/{job_id}", dependencies=[Depends(verify_api_key)])
async def get_video_job_status(job_id: str):
    """Get status of a video processing job."""
    job = get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "job_id": job.job_id,
        "status": job.status,
        "progress_percent": job.progress_percent,
        "frames_processed": job.frames_processed,
        "total_frames": job.total_frames,
        "alerts_found": job.alerts_found,
        "video_filename": job.video_filename,
        "error_message": job.error_message,
    }


async def process_video_background(job_id: str, video_path: str, video_filename: str):
    """Process video in background, updating job status."""
    global total_persons, compliant_persons, temporal_buffers

    job = get_job_status(job_id)
    if not job:
        print(f"Job {job_id} not found")
        return

    job.status = "processing"
    save_job(job)

    try:
        # Reset temporal buffers for each new video
        temporal_buffers = {}

        cap = cv2.VideoCapture(video_path)
        frames_processed = 0
        alerts_found = 0
        last_save_time = datetime.now()
        last_alert_time = datetime.min
        last_update_time = datetime.now()

        # Get actual frame count if available
        total_frames = job.total_frames
        actual_frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        if actual_frame_count > 0:
            total_frames = int(actual_frame_count)
            job.total_frames = total_frames

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
                cls_name = (
                    CLASS_NAMES[cls_id] if cls_id < len(CLASS_NAMES) else "unknown"
                )

                if cls_name in VIOLATION_CLASSES:
                    violations.add(cls_name)
                if cls_name == "Person":
                    persons_in_frame += 1
                if cls_name == "Hardhat":
                    has_hardhat = True
                if cls_name == "Safety Vest":
                    has_vest = True

            n_compliant = (
                1 if (persons_in_frame > 0 and has_hardhat and has_vest) else 0
            )

            metrics_state["frames_processed"] += 1
            metrics_state["persons_detected"] += persons_in_frame
            total_persons += persons_in_frame
            compliant_persons += n_compliant

            confirmed = update_temporal_buffers(violations)

            if violations:
                metrics_state["violation_frames"] += 1

            if confirmed:
                now = datetime.now()
                if (now - last_alert_time).total_seconds() >= 2.0:
                    metrics_state["confirmed_alerts"] += 1
                    alerts_found += 1
                    ts = datetime.now()
                    ts_str = ts.strftime("%Y%m%d_%H%M%S_%f")
                    fname = INCIDENTS_DIR / f"incident_{ts_str}.jpg"
                    overlay_frame = draw_violation_overlay(frame, results)
                    cv2.imwrite(str(fname), overlay_frame)
                    entry = {
                        "id": str(uuid.uuid4()),
                        "timestamp": ts.strftime("Y-%m-%d %H:%M:%S"),
                        "missing_ppe": list(confirmed),
                        "frame_number": metrics_state["frames_processed"],
                        "image_path": f"/api/incidents/images/incident_{ts_str}.jpg",
                        "image_filename": fname.name,
                        "is_video": True,
                        "video_filename": video_filename,
                    }
                    incidents_state.insert(0, entry)
                    save_incidents()
                    save_metrics()
                    last_save_time = datetime.now()
                    last_alert_time = now

            frames_processed += 1

            # Update job progress every 30 frames or 2 seconds
            now = datetime.now()
            if (
                frames_processed % 30 == 0
                or (now - last_update_time).total_seconds() >= 2
            ):
                progress = (
                    min(95, (frames_processed / total_frames * 100))
                    if total_frames > 0
                    else 0
                )
                job.frames_processed = frames_processed
                job.progress_percent = round(progress, 1)
                job.alerts_found = alerts_found
                save_job(job)
                last_update_time = now

            # Yield control every 5 frames
            if frames_processed % 5 == 0:
                await asyncio.sleep(0.001)
                if (datetime.now() - last_save_time).total_seconds() > 5:
                    save_metrics()
                    last_save_time = datetime.now()

        cap.release()
        save_incidents()
        save_metrics()

        # Mark job as completed
        job.status = "completed"
        job.frames_processed = frames_processed
        job.progress_percent = 100
        job.alerts_found = alerts_found
        job.completed_at = datetime.now()
        save_job(job)

    except Exception as e:
        print(f"Video processing failed for job {job_id}: {e}")
        job.status = "failed"
        job.error_message = str(e)
        save_job(job)


# Legacy sync endpoint for backward compatibility (not recommended for large videos)
async def process_video(file: UploadFile):
    """Deprecated: Synchronous video processing."""
    global total_persons, compliant_persons, temporal_buffers

    temporal_buffers = {}

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    video_filename = f"upload_{timestamp}_{file.filename or 'video'}.mp4"
    video_path = VIDEOS_DIR / video_filename
    content = await file.read()
    with open(video_path, "wb") as f:
        f.write(content)

    cap = cv2.VideoCapture(str(video_path))
    frames_processed = 0
    alerts_found = 0
    last_save_time = datetime.now()
    last_alert_time = datetime.min

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
            now = datetime.now()
            if (now - last_alert_time).total_seconds() >= 2.0:
                metrics_state["confirmed_alerts"] += 1
                alerts_found += 1
                ts = datetime.now()
                ts_str = ts.strftime("%Y%m%d_%H%M%S_%f")
                fname = INCIDENTS_DIR / f"incident_{ts_str}.jpg"
                overlay_frame = draw_violation_overlay(frame, results)
                cv2.imwrite(str(fname), overlay_frame)
                entry = {
                    "id": str(uuid.uuid4()),
                    "timestamp": ts.strftime("%Y-%m-%d %H:%M:%S"),
                    "missing_ppe": list(confirmed),
                    "frame_number": metrics_state["frames_processed"],
                    "image_path": f"/api/incidents/images/incident_{ts_str}.jpg",
                    "image_filename": fname.name,
                    "is_video": True,
                    "video_filename": video_filename,
                }
                incidents_state.insert(0, entry)
                save_incidents()
                save_metrics()
                last_save_time = datetime.now()
                last_alert_time = now

        frames_processed += 1

        if frames_processed % 5 == 0:
            await asyncio.sleep(0.001)
            if (datetime.now() - last_save_time).total_seconds() > 5:
                save_metrics()
                last_save_time = datetime.now()

    cap.release()
    save_incidents()
    save_metrics()

    return {
        "frames_processed": frames_processed,
        "alerts_count": alerts_found,
        "video_path": str(video_path),
    }


if __name__ == "__main__":
    import uvicorn

    # Load all persisted data from disk on startup
    load_metrics()
    load_incidents()
    uvicorn.run(app, host="0.0.0.0", port=8000)
