from fastapi import APIRouter, Depends

from ..container import Services, get_services

router = APIRouter()


@router.get("/health")
def health(services: Services = Depends(get_services)):
    return {"status": "healthy", "model_loaded": services.detector.loaded}
