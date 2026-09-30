"""Model configuration: thresholds and weight uploads."""

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..container import Services, get_services
from ..detection.analysis import TEMPORAL_WINDOW
from ..services.uploads import save_upload

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/config")
def get_config(services: Services = Depends(get_services)):
    detector = services.detector
    return {
        "model_loaded": detector.loaded,
        "model_name": detector.weights_path.name if detector.loaded else "",
        "confidence_threshold": detector.confidence_threshold,
        "nms_iou_threshold": detector.nms_iou_threshold,
        "temporal_window": TEMPORAL_WINDOW,
    }


@router.post("/config/thresholds")
def update_thresholds(
    conf: float = 0.40, iou: float = 0.45, services: Services = Depends(get_services)
):
    detector = services.detector
    detector.set_thresholds(conf, iou)
    return {
        "confidence_threshold": detector.confidence_threshold,
        "nms_iou_threshold": detector.nms_iou_threshold,
    }


@router.post("/model/reload")
def reload_model(
    weights_file: UploadFile = File(...), services: Services = Depends(get_services)
):
    filename = Path(weights_file.filename or "uploaded.pt").name
    save_path = services.settings.models_dir / filename
    save_upload(weights_file, save_path)
    try:
        services.detector.load(save_path)
    except Exception as exc:
        logger.exception("Failed to load uploaded weights %s", filename)
        raise HTTPException(
            status_code=500, detail="Failed to load model from the uploaded file"
        ) from exc
    return {
        "status": "success",
        "model_loaded": True,
        "model_name": filename,
        "path": str(save_path),
    }
