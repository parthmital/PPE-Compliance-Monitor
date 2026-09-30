from fastapi import APIRouter, Depends

from ..container import Services, get_services

router = APIRouter()


@router.get("/metrics")
def get_metrics(services: Services = Depends(get_services)):
    return {"metrics": services.metrics.snapshot()}
