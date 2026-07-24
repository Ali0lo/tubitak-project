"""Data access layer for the Notification model."""
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import func, select, update, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationStatus


class NotificationRepository:
    """Encapsulates all database access for Notification rows."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, notification_id: uuid.UUID) -> Optional[Notification]:
        result = await self.db.execute(
            select(Notification).where(Notification.id == notification_id)
        )
        return result.scalar_one_or_none()

    async def get_by_source(
        self, source: str, source_reference_id: str
    ) -> Optional[Notification]:
        result = await self.db.execute(
            select(Notification).where(
                Notification.source == source,
                Notification.source_reference_id == source_reference_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_for_user(
        self, user_id: uuid.UUID, *, offset: int, limit: int, unread_only: bool = False
    ) -> Tuple[List[Notification], int]:
        now = datetime.now(timezone.utc)
        stmt = select(Notification).where(
            Notification.user_id == user_id,
            or_(
                Notification.scheduled_for <= now,
                Notification.status.in_([NotificationStatus.QUEUED, NotificationStatus.SENT, NotificationStatus.FAILED]),
            ),
        )

        if unread_only:
            stmt = stmt.where(Notification.is_read == False)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = (
            stmt.order_by(Notification.scheduled_for.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def get_unread_count(self, user_id: uuid.UUID) -> int:
        now = datetime.now(timezone.utc)
        stmt = select(func.count()).select_from(Notification).where(
            Notification.user_id == user_id,
            Notification.is_read == False,
            or_(
                Notification.scheduled_for <= now,
                Notification.status.in_([NotificationStatus.QUEUED, NotificationStatus.SENT, NotificationStatus.FAILED]),
            ),
        )
        return (await self.db.execute(stmt)).scalar_one()

    async def mark_as_read(
        self, notification: Notification, read_at: datetime
    ) -> Notification:
        notification.is_read = True
        notification.read_at = read_at
        await self.db.flush()
        await self.db.refresh(notification)
        return notification

    async def mark_all_as_read(self, user_id: uuid.UUID, read_at: datetime) -> int:
        stmt = (
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.is_read == False,
            )
            .values(is_read=True, read_at=read_at)
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.rowcount

    async def upsert(
        self,
        *,
        source: str,
        source_reference_id: str,
        user_id: uuid.UUID,
        scheduled_for: datetime,
        message: str,
    ) -> Notification:
        existing = await self.get_by_source(source, source_reference_id)
        if existing is not None:
            existing.scheduled_for = scheduled_for
            existing.message = message
            existing.status = NotificationStatus.PENDING
            existing.sent_at = None
            existing.failure_reason = None
            existing.is_read = False
            existing.read_at = None
            await self.db.flush()
            await self.db.refresh(existing)
            return existing

        notification = Notification(
            source=source,
            source_reference_id=source_reference_id,
            user_id=user_id,
            scheduled_for=scheduled_for,
            message=message,
        )
        self.db.add(notification)
        await self.db.flush()
        await self.db.refresh(notification)
        return notification

    async def cancel_by_source(
        self, source: str, source_reference_id: str
    ) -> Optional[Notification]:
        notification = await self.get_by_source(source, source_reference_id)
        if notification is None or notification.status in (
            NotificationStatus.SENT,
            NotificationStatus.CANCELLED,
        ):
            return notification
        notification.status = NotificationStatus.CANCELLED
        await self.db.flush()
        await self.db.refresh(notification)
        return notification

    async def claim_due(
        self, *, before: datetime, limit: int
    ) -> List[uuid.UUID]:
        """Atomically transition due, pending notifications to QUEUED.

        Uses a single UPDATE ... RETURNING so that if multiple
        scheduler instances run concurrently, each due notification is
        claimed by exactly one of them.
        """
        subquery = (
            select(Notification.id)
            .where(
                Notification.status == NotificationStatus.PENDING,
                Notification.scheduled_for <= before,
            )
            .order_by(Notification.scheduled_for.asc())
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        stmt = (
            update(Notification)
            .where(Notification.id.in_(subquery))
            .values(status=NotificationStatus.QUEUED)
            .returning(Notification.id)
        )
        result = await self.db.execute(stmt)
        ids = [row[0] for row in result.all()]
        await self.db.commit()
        return ids

    async def mark_sent(self, notification: Notification, sent_at: datetime) -> Notification:
        notification.status = NotificationStatus.SENT
        notification.sent_at = sent_at
        notification.failure_reason = None
        await self.db.flush()
        await self.db.refresh(notification)
        return notification

    async def mark_failed(
        self, notification: Notification, reason: str
    ) -> Notification:
        notification.status = NotificationStatus.FAILED
        notification.failure_reason = reason[:1024]
        await self.db.flush()
        await self.db.refresh(notification)
        return notification
