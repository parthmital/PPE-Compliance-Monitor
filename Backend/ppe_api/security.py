"""Optional API key check, enabled when API_KEY is set."""

import secrets

from fastapi import Depends, HTTPException, Security
from fastapi.security import APIKeyHeader

from .container import Services, get_services

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_api_key(
    api_key: str | None = Security(_api_key_header),
    services: Services = Depends(get_services),
) -> None:
    expected = services.settings.api_key
    if expected and not secrets.compare_digest(api_key or "", expected):
        raise HTTPException(status_code=403, detail="Could not validate API Key")
