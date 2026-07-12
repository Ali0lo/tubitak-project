"""Business logic for reminder management."""
import uuid
from typing import List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.notification_client import NotificationClient
from app.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.models.reminder import Reminder
from app.repositories.meeting_repository import MeetingRepository
from app.repositories.reminder_repository import ReminderRepository
from app.repositories.task_repository import TaskRepository
from app.schemas.reminder import ReminderCreate, ReminderUpdate


class ReminderService:
    """Orchestrates reminder use cases, enforcing ownership rules.

    Reminder dispatch itself is owned by notification-service; this
    service only schedules/cancels notifications via NotificationClient
    when a reminder is created, updated, or deleted. If the linked task
    or meeting belongs to another user, creation is rejected.
    """

    def __init__(
        self,
        db: AsyncSession,
        notification_client: Optional[NotificationClient] = None,
    ) -> None:
        self.db = db
        self.reminders = ReminderRepository(db)
        self.tasks = TaskRepository(db)
        self.meetings = MeetingRepository(db)
        self.notification_client = notification_client or NotificationClient()

    async def create_reminder(
        self, user_id: uuid.UUID, payload: ReminderCreate
    ) -> Reminder:
        if payload.task_id is not None:
            task = await self.tasks.get_by_id(payload.task_id, with_tags=False)
            if task is None:
                raise NotFoundError("Task")
            if task.user_id != user_id:
                raise ForbiddenError("You do not have access to this task")

        if payload.meeting_id is not None:
            meeting = await self.meetings.get_by_id(
                payload.meeting_id, with_participants=False
            )
            if meeting is None:
                raise NotFoundError("Meeting")
            if meeting.user_id != user_id:
                raise ForbiddenError("You do not have access to this meeting")

        reminder = await self.reminders.create(
            user_id=user_id,
            remind_at=payload.remind_at,
            message=payload.message,
            task_id=payload.task_id,
            meeting_id=payload.meeting_id,
        )
        await self.db.commit()

        await self.notification_client.schedule_reminder_notification(
            reminder_id=reminder.id,
            user_id=user_id,
            remind_at=reminder.remind_at,
            message=reminder.message,
        )
        return reminder

    async def get_reminder(
        self, user_id: uuid.UUID, reminder_id: uuid.UUID
    ) -> Reminder:
        reminder = await self.reminders.get_by_id(reminder_id)
        if reminder is None:
            raise NotFoundError("Reminder")
        self._assert_owner(reminder, user_id)
        return reminder

    async def list_reminders(
        self,
        user_id: uuid.UUID,
        *,
        offset: int,
        limit: int,
        is_sent: Optional[bool] = None,
    ) -> Tuple[List[Reminder], int]:
        return await self.reminders.list_for_user(
            user_id, offset=offset, limit=limit, is_sent=is_sent
        )

    async def update_reminder(
        self,
        user_id: uuid.UUID,
        reminder_id: uuid.UUID,
        payload: ReminderUpdate,
    ) -> Reminder:
        reminder = await self.get_reminder(user_id, reminder_id)
        if reminder.is_sent:
            raise ValidationError("Cannot modify a reminder that has already fired")

        updated = await self.reminders.update(
            reminder, remind_at=payload.remind_at, message=payload.message
        )
        await self.db.commit()

        if payload.remind_at is not None or payload.message is not None:
            await self.notification_client.schedule_reminder_notification(
                reminder_id=updated.id,
                user_id=user_id,
                remind_at=updated.remind_at,
                message=updated.message,
            )
        return updated

    async def delete_reminder(
        self, user_id: uuid.UUID, reminder_id: uuid.UUID
    ) -> None:
        reminder = await self.get_reminder(user_id, reminder_id)
        await self.reminders.delete(reminder)
        await self.db.commit()
        await self.notification_client.cancel_reminder_notification(
            reminder_id=reminder_id
        )

    @staticmethod
    def _assert_owner(reminder: Reminder, user_id: uuid.UUID) -> None:
        if reminder.user_id != user_id:
            raise ForbiddenError("You do not have access to this reminder")
