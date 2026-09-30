from fastapi import APIRouter, Body, Depends

from ..container import Services, get_services

router = APIRouter()


@router.get("/session")
def get_session_state(services: Services = Depends(get_services)):
    return {"state": services.sessions.load()}


@router.post("/session")
def update_session_state(
    state: dict = Body(...), services: Services = Depends(get_services)
):
    services.sessions.save(state)
    return {"status": "ok"}


@router.delete("/session")
def clear_session_state(services: Services = Depends(get_services)):
    services.sessions.clear()
    return {"status": "ok"}
