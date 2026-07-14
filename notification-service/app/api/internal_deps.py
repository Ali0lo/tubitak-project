"""Dependency guarding endpoints only core-service should call directly."""
from typing import Optional

from fastapi import Header, HTTPException, status

from app.core.config import get_settings

settings = get_settings()


async def verify_internal_api_key(
    x_internal_api_key: Optional[str] = Header(default=None),
) -> None:
    if not x_internal_api_key or x_internal_api_key != settings.INTERNAL_SERVICE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing internal API key",
        )
