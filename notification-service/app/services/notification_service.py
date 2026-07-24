"""Business logic for scheduling, cancelling, and listing notifications."""
import uuid
from datetime import datetime, timezone
from typing import List, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.notification import Notification, NotificationStatus
from app.queue.redis_queue import NotificationQueue
from app.repositories.notification_repository import NotificationRepository
from app.schemas.notification import ScheduleNotificationRequest


class NotificationService:
    """Orchestrates notification scheduling for the internal API."""

    def __init__(self, db: AsyncSession, queue: NotificationQueue) -> None:
        self.db = db
        self.notifications = NotificationRepository(db)
        self.queue = queue

    async def schedule(self, payload: ScheduleNotificationRequest) -> Notification:
        notification = await self.notifications.upsert(
            source=payload.source,
            source_reference_id=payload.source_reference_id,
            user_id=payload.user_id,
            scheduled_for=payload.scheduled_for,
            message=payload.message,
        )
        await self.db.commit()

        # If the requested time has already passed (or is within this
        # instant), dispatch it immediately rather than waiting for
        # the next scheduler poll.
        now = datetime.now(timezone.utc)
        if (
            notification.scheduled_for.replace(tzinfo=timezone.utc) <= now
            and notification.status == NotificationStatus.PENDING
        ):
            notification.status = NotificationStatus.QUEUED
            await self.db.flush()
            await self.db.commit()
            await self.queue.enqueue(notification.id)

        return notification

    async def cancel(self, source: str, source_reference_id: str) -> Notification:
        notification = await self.notifications.cancel_by_source(
            source, source_reference_id
        )
        if notification is None:
            raise NotFoundError("Notification")
        await self.db.commit()
        return notification

    async def get_for_user(
        self, user_id: uuid.UUID, notification_id: uuid.UUID
    ) -> Notification:
        notification = await self.notifications.get_by_id(notification_id)
        if notification is None:
            raise NotFoundError("Notification")
        if notification.user_id != user_id:
            raise ForbiddenError("You do not have access to this notification")
        return notification

    async def list_for_user(
        self, user_id: uuid.UUID, *, offset: int, limit: int, unread_only: bool = False
    ) -> Tuple[List[Notification], int]:
        return await self.notifications.list_for_user(
            user_id, offset=offset, limit=limit, unread_only=unread_only
        )

    async def get_unread_count(self, user_id: uuid.UUID) -> int:
        return await self.notifications.get_unread_count(user_id)

    async def mark_as_read(
        self, user_id: uuid.UUID, notification_id: uuid.UUID
    ) -> Notification:
        notification = await self.get_for_user(user_id, notification_id)
        now = datetime.now(timezone.utc)
        updated = await self.notifications.mark_as_read(notification, now)
        await self.db.commit()
        return updated

    async def mark_all_as_read(self, user_id: uuid.UUID) -> int:
        now = datetime.now(timezone.utc)
        return await self.notifications.mark_all_as_read(user_id, now)

