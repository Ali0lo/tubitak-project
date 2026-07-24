"""Service layer for reminder scheduling and management."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.queue.redis_queue import NotificationQueue
from app.schemas.notification import ScheduleNotificationRequest
from app.services.notification_service import NotificationService


class ReminderService:
    """Orchestrates reminder scheduling wrapping NotificationService."""

    def __init__(self, db: AsyncSession, queue: NotificationQueue) -> None:
        self.notification_service = NotificationService(db, queue)

    async def schedule_reminder(
        self,
        user_id: uuid.UUID,
        message: str,
        scheduled_for: datetime,
        source_reference_id: str,
        source: str = "reminder",
    ) -> Notification:
        """Schedule a new reminder notification."""
        payload = ScheduleNotificationRequest(
            source=source,
            source_reference_id=source_reference_id,
            user_id=user_id,
            scheduled_for=scheduled_for,
            message=message,
        )
        return await self.notification_service.schedule(payload)

    async def cancel_reminder(
        self, source_reference_id: str, source: str = "reminder"
    ) -> Notification:
        """Cancel a previously scheduled reminder notification."""
        return await self.notification_service.cancel(source, source_reference_id)
