"""Backend entry point: `python api.py` or `uvicorn api:app`."""

import uvicorn

from ppe_api.config import load_settings
from ppe_api.logging_config import build_log_config
from ppe_api.main import create_app

settings = load_settings()
app = create_app(settings)

if __name__ == "__main__":
    uvicorn.run(
        app, host=settings.host, port=settings.port, log_config=build_log_config()
    )
