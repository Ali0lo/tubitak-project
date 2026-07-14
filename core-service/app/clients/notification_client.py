"""HTTP client for core-service -> notification-service communication.

This defines the internal API contract that notification-service's
`/api/v1/notifications/schedule` and `/api/v1/notifications/{id}/cancel`
endpoints implement. Failures here are logged and swallowed rather than
raised, so that a temporary notification-service outage never blocks a
task/meeting/reminder write in core-service.
"""
import logging
import uuid
from datetime import datetime
from typing import Optional

import httpx

from app.core.config import get_settings

logger = logging.getLogger("core-service.notification_client")
settings = get_settings()


class NotificationClient:
    """Thin async wrapper around notification-service's HTTP API."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> None:
        self.base_url = base_url or settings.NOTIFICATION_SERVICE_URL
        self.timeout = timeout or settings.NOTIFICATION_SERVICE_TIMEOUT_SECONDS

    async def schedule_reminder_notification(
        self,
        *,
        reminder_id: uuid.UUID,
        user_id: uuid.UUID,
        remind_at: datetime,
        message: Optional[str],
    ) -> bool:
        """Ask notification-service to deliver a notification at remind_at.

        Returns True if the request was accepted, False if it failed.
        A False return is non-fatal for the caller.
        """
        payload = {
            "source": "core-service",
            "source_reference_id": str(reminder_id),
            "user_id": str(user_id),
            "scheduled_for": remind_at.isoformat(),
            "message": message or "You have a reminder",
        }
        try:
            async with httpx.AsyncClient(
                base_url=self.base_url, timeout=self.timeout
            ) as client:
                response = await client.post(
                    "/api/v1/notifications/schedule",
                    json=payload,
                    headers={
                        "X-Internal-Api-Key": settings.INTERNAL_SERVICE_API_KEY
                    },
                )
                response.raise_for_status()
            return True
        except httpx.HTTPError as exc:
            logger.warning(
                "Failed to schedule notification for reminder %s: %s",
                reminder_id,
                exc,
            )
            return False

    async def cancel_reminder_notification(self, *, reminder_id: uuid.UUID) -> bool:
        """Ask notification-service to cancel a previously scheduled notification."""
        try:
            async with httpx.AsyncClient(
                base_url=self.base_url, timeout=self.timeout
            ) as client:
                response = await client.post(
                    f"/api/v1/notifications/source/core-service/{reminder_id}/cancel",
                    headers={
                        "X-Internal-Api-Key": settings.INTERNAL_SERVICE_API_KEY
                    },
                )
                response.raise_for_status()
            return True
        except httpx.HTTPError as exc:
            logger.warning(
                "Failed to cancel notification for reminder %s: %s",
                reminder_id,
                exc,
            )
            return False
