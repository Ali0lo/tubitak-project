"""Data access layer for the Reminder model."""
import uuid
from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reminder import Reminder


class ReminderRepository:
    """Encapsulates all database access for Reminder rows."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, reminder_id: uuid.UUID) -> Optional[Reminder]:
        result = await self.db.execute(
            select(Reminder).where(Reminder.id == reminder_id)
        )
        return result.scalar_one_or_none()

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        *,
        offset: int,
        limit: int,
        is_sent: Optional[bool] = None,
    ) -> Tuple[List[Reminder], int]:
        stmt = select(Reminder).where(Reminder.user_id == user_id)
        if is_sent is not None:
            stmt = stmt.where(Reminder.is_sent == is_sent)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = stmt.order_by(Reminder.remind_at.asc()).offset(offset).limit(limit)
        result = await self.db.execute(stmt)
        items = list(result.scalars().all())
        return items, total

    async def list_due(self, *, before: datetime, limit: int = 500) -> List[Reminder]:
        """Return unsent reminders whose remind_at has passed.

        Used by a scheduled worker (or notification-service poller) to
        find reminders that need to be dispatched.
        """
        stmt = (
            select(Reminder)
            .where(Reminder.is_sent.is_(False), Reminder.remind_at <= before)
            .order_by(Reminder.remind_at.asc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        remind_at: datetime,
        message: Optional[str],
        task_id: Optional[uuid.UUID],
        meeting_id: Optional[uuid.UUID],
    ) -> Reminder:
        reminder = Reminder(
            user_id=user_id,
            remind_at=remind_at,
            message=message,
            task_id=task_id,
            meeting_id=meeting_id,
        )
        self.db.add(reminder)
        await self.db.flush()
        await self.db.refresh(reminder)
        return reminder

    async def update(
        self,
        reminder: Reminder,
        *,
        remind_at: Optional[datetime] = None,
        message: Optional[str] = None,
    ) -> Reminder:
        if remind_at is not None:
            reminder.remind_at = remind_at
        if message is not None:
            reminder.message = message
        await self.db.flush()
        await self.db.refresh(reminder)
        return reminder

    async def mark_sent(self, reminder: Reminder) -> Reminder:
        reminder.is_sent = True
        await self.db.flush()
        await self.db.refresh(reminder)
        return reminder

    async def get_task_reminder_metadata(
        self, task_ids: List[uuid.UUID], now: datetime
    ) -> dict:
        if not task_ids:
            return {}
        
        # Next upcoming unsent reminder
        next_stmt = (
            select(Reminder.task_id, func.min(Reminder.remind_at))
            .where(
                Reminder.task_id.in_(task_ids),
                Reminder.is_sent.is_(False),
                Reminder.remind_at >= now,
            )
            .group_by(Reminder.task_id)
        )
        next_res = await self.db.execute(next_stmt)
        next_map = {row[0]: row[1] for row in next_res.all()}

        # Last sent notification
        last_stmt = (
            select(Reminder.task_id, func.max(Reminder.remind_at))
            .where(
                Reminder.task_id.in_(task_ids),
                Reminder.is_sent.is_(True),
            )
            .group_by(Reminder.task_id)
        )
        last_res = await self.db.execute(last_stmt)
        last_map = {row[0]: row[1] for row in last_res.all()}

        return {
            tid: {
                "next_reminder_at": next_map.get(tid),
                "last_notification_sent": last_map.get(tid),
            }
            for tid in task_ids
        }

    async def get_meeting_reminder_metadata(
        self, meeting_ids: List[uuid.UUID], now: datetime
    ) -> dict:
        if not meeting_ids:
            return {}

        next_stmt = (
            select(Reminder.meeting_id, func.min(Reminder.remind_at))
            .where(
                Reminder.meeting_id.in_(meeting_ids),
                Reminder.is_sent.is_(False),
                Reminder.remind_at >= now,
            )
            .group_by(Reminder.meeting_id)
        )
        next_res = await self.db.execute(next_stmt)
        next_map = {row[0]: row[1] for row in next_res.all()}

        last_stmt = (
            select(Reminder.meeting_id, func.max(Reminder.remind_at))
            .where(
                Reminder.meeting_id.in_(meeting_ids),
                Reminder.is_sent.is_(True),
            )
            .group_by(Reminder.meeting_id)
        )
        last_res = await self.db.execute(last_stmt)
        last_map = {row[0]: row[1] for row in last_res.all()}

        return {
            mid: {
                "next_reminder_at": next_map.get(mid),
                "last_notification_sent": last_map.get(mid),
            }
            for mid in meeting_ids
        }

    async def delete(self, reminder: Reminder) -> None:
        await self.db.delete(reminder)
        await self.db.flush()

