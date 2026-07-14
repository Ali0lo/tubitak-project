"""Dependency guarding endpoints meant only for service-to-service calls."""
from typing import Optional

from fastapi import Header, HTTPException, status

from app.config.settings import get_settings

settings = get_settings()


async def verify_internal_api_key(
    x_internal_api_key: Optional[str] = Header(default=None),
) -> None:
    if not x_internal_api_key or x_internal_api_key != settings.INTERNAL_SERVICE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing internal API key",
        )
