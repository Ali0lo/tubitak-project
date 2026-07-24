"""HTTP client for core-service -> auth-service communication."""
import logging
import uuid
from typing import Optional

import httpx

from app.core.config import get_settings

logger = logging.getLogger("core-service.auth_client")
settings = get_settings()


class AuthClient:
    """Thin async wrapper around auth-service internal API."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> None:
        self.base_url = (base_url or getattr(settings, "AUTH_SERVICE_URL", "http://auth-service:8000")).rstrip("/")
        self.timeout = timeout or getattr(settings, "AUTH_SERVICE_TIMEOUT_SECONDS", 5.0)

    async def get_user_id_by_email(self, email: str) -> Optional[uuid.UUID]:
        """Look up user_id by email address from auth-service."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/api/v1/internal/users/by-email/{email}",
                    headers={"X-Internal-Api-Key": settings.INTERNAL_SERVICE_API_KEY},
                    timeout=self.timeout,
                )
                if response.status_code == 200:
                    data = response.json()
                    user_id_str = data.get("id")
                    if user_id_str:
                        return uuid.UUID(user_id_str)
        except Exception as exc:
            logger.warning("Failed to lookup user_id for email %s: %s", email, exc)
        return None
