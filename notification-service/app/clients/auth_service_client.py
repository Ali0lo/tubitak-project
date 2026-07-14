"""HTTP client for notification-service -> auth-service communication.

Used only to resolve a user's email address before sending a
notification email. Calls auth-service's internal user-lookup
endpoint directly (not through the gateway), authenticated with the
shared INTERNAL_SERVICE_API_KEY rather than a user's own token, since
this is a service-to-service call with no end-user request in flight.
"""
import logging
import uuid
from typing import Optional

import httpx

from app.core.config import get_settings

logger = logging.getLogger("notification-service.auth_client")
settings = get_settings()


class AuthServiceClient:
    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
        client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self.base_url = (base_url or settings.AUTH_SERVICE_URL).rstrip("/")
        self.timeout = timeout or settings.AUTH_SERVICE_TIMEOUT_SECONDS
        self._client = client

    async def get_user_email(self, user_id: uuid.UUID) -> Optional[str]:
        """Return the user's email, or None if the lookup fails for any reason.

        A missing email should not crash a dispatch attempt — the
        caller falls back to skipping the email channel and the
        in-app notification (the stored row itself) is still valid.
        """
        client = self._client or httpx.AsyncClient()
        owns_client = self._client is None
        try:
            response = await client.get(
                f"{self.base_url}/api/v1/internal/users/{user_id}",
                headers={"X-Internal-Api-Key": settings.INTERNAL_SERVICE_API_KEY},
                timeout=self.timeout,
            )
        except httpx.HTTPError as exc:
            logger.warning("Failed to reach auth-service for user %s: %s", user_id, exc)
            return None
        finally:
            if owns_client:
                await client.aclose()

        if response.status_code != 200:
            logger.warning(
                "auth-service returned %s looking up user %s",
                response.status_code,
                user_id,
            )
            return None

        data = response.json()
        return data.get("email")
