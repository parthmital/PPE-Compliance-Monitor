"""FastAPI application factory."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import Settings, load_settings
from .container import Services, build_services
from .routes import api_router
from .services.incidents import INCIDENT_IMAGES_URL


def create_app(
    settings: Settings | None = None, services: Services | None = None
) -> FastAPI:
    settings = settings or load_settings()
    settings.ensure_dirs()
    services = services or build_services(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        services.load_state()
        yield
        services.metrics.save()

    app = FastAPI(title="PPE Compliance Monitor", lifespan=lifespan)
    app.state.services = services

    @app.middleware("http")
    async def limit_upload_size(request: Request, call_next):
        length = request.headers.get("content-length")
        if (
            request.method == "POST"
            and length
            and length.isdigit()
            and int(length) > settings.max_upload_size
        ):
            return JSONResponse(status_code=413, content={"error": "Payload Too Large"})
        return await call_next(request)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # Mounted before the router so these prefixes are not shadowed.
    app.mount("/api/videos", StaticFiles(directory=settings.videos_dir), name="videos")
    app.mount(
        INCIDENT_IMAGES_URL,
        StaticFiles(directory=settings.incidents_dir),
        name="incident_images",
    )
    app.include_router(api_router)
    return app
