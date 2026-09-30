from fastapi import APIRouter, Depends

from ..security import verify_api_key
from . import detection, incidents, metrics, model, session, system

api_router = APIRouter(prefix="/api")
api_router.include_router(system.router)
for module in (model, metrics, incidents, session, detection):
    api_router.include_router(module.router, dependencies=[Depends(verify_api_key)])
