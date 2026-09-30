from fastapi import APIRouter, Depends

from ..container import Services, get_services

router = APIRouter()


@router.get("/incidents")
def get_incidents(services: Services = Depends(get_services)):
    return {"incidents": services.incidents.all()}


@router.delete("/incidents/clear")
def clear_incidents(services: Services = Depends(get_services)):
    services.incidents.clear()
    return {"status": "ok"}
