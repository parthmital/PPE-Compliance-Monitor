"""Photo detection (synchronous) and video detection (background job)."""

import cv2
import numpy as np
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from ..container import Services, get_services
from ..services.jobs import VideoJob
from ..services.uploads import save_upload, upload_name

router = APIRouter(prefix="/detect")

# Rough frame estimate when the container reports no frame count.
BYTES_PER_FRAME_ESTIMATE = 50_000
MAX_FRAME_ESTIMATE = 30_000


def _model_not_loaded(**extra) -> JSONResponse:
    return JSONResponse(status_code=500, content={"error": "Model not loaded", **extra})


@router.post("/image")
def detect_image(
    file: UploadFile = File(...), services: Services = Depends(get_services)
):
    if not services.detector.loaded:
        return _model_not_loaded(detections=[])
    filename = upload_name(file.filename, "image", ".jpg")
    contents = file.file.read()
    (services.settings.images_dir / filename).write_bytes(contents)
    frame = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="File is not a readable image")
    analysis = services.pipeline.analyse_image(frame, filename)
    height, width = frame.shape[:2]
    return {
        "detections": analysis.detections,
        "image_width": width,
        "image_height": height,
    }


@router.post("/video")
def detect_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    services: Services = Depends(get_services),
):
    if not services.detector.loaded:
        return _model_not_loaded()
    filename = upload_name(file.filename, "video", ".mp4")
    path = services.settings.videos_dir / filename
    save_upload(file, path)

    cap = cv2.VideoCapture(str(path))
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()
    estimated = (
        frame_count
        if frame_count > 0
        else min(path.stat().st_size // BYTES_PER_FRAME_ESTIMATE, MAX_FRAME_ESTIMATE)
    )

    job = VideoJob(
        video_filename=filename, video_path=str(path), total_frames=estimated
    )
    services.jobs.save(job)
    # Sync background tasks run in the threadpool, off the event loop.
    background_tasks.add_task(services.pipeline.process_video, job)
    return {
        "job_id": job.job_id,
        "status": job.status,
        "message": "Video processing started",
        "estimated_frames": estimated,
    }


@router.get("/video/{job_id}")
def get_video_job_status(job_id: str, services: Services = Depends(get_services)):
    job = services.jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.public()
