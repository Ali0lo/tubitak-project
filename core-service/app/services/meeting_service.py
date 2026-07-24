"""Business logic for meeting management."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.notification_client import NotificationClient
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.meeting import (
    Meeting,
    MeetingStatus,
    ParticipantResponseStatus,
)
from app.repositories.meeting_repository import MeetingRepository
from app.schemas.meeting import MeetingCreate, MeetingUpdate
from app.services.reminder_service import ReminderService
from app.schemas.reminder import ReminderCreate


class MeetingService:
    """Orchestrates meeting use cases, enforcing ownership rules."""

    def __init__(
        self,
        db: AsyncSession,
        notification_client: Optional[NotificationClient] = None,
    ) -> None:
        self.db = db
        self.meetings = MeetingRepository(db)
        self.reminder_service = ReminderService(db)
        self.notification_client = notification_client or NotificationClient()

    async def get_reminder_metadata(self, meeting_ids: List[uuid.UUID]) -> dict:
        now = datetime.now(timezone.utc)
        return await self.reminder_service.reminders.get_meeting_reminder_metadata(meeting_ids, now)

    async def create_meeting(
        self, user_id: uuid.UUID, payload: MeetingCreate
    ) -> Meeting:
        participants = [(p.email, p.name) for p in payload.participants]
        meeting = await self.meetings.create(
            user_id=user_id,
            title=payload.title,
            description=payload.description,
            location=payload.location,
            start_time=payload.start_time,
            end_time=payload.end_time,
            participants=participants,
            is_recurring=payload.is_recurring,
            recurrence_rule=payload.recurrence_rule,
        )
        await self.db.commit()

        # Schedule Default Meeting Reminders (1 hour, 30 min, 15 min, 5 min, at start time)
        await self._schedule_default_meeting_reminders(user_id, meeting)

        return meeting

    async def _schedule_default_meeting_reminders(self, user_id: uuid.UUID, meeting: Meeting) -> None:
        now = datetime.now(timezone.utc)
        start_time = meeting.start_time
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        else:
            start_time = start_time.astimezone(timezone.utc)

        target_user_ids = {user_id}
        if meeting.participants:
            for participant in meeting.participants:
                if participant.user_id:
                    target_user_ids.add(participant.user_id)

        # Notify participants of new invitation
        for uid in target_user_ids:
            if uid != user_id:
                try:
                    await self.notification_client.schedule_reminder_notification(
                        reminder_id=f"{meeting.id}:invitation:{uid}",
                        user_id=uid,
                        remind_at=now,
                        message=f"Meeting Invitation: You are included in '{meeting.title}'",
                    )
                except Exception:
                    pass

        offsets = [
            ("1h", timedelta(hours=1), f"Meeting '{meeting.title}' starting in 1 hour"),
            ("30m", timedelta(minutes=30), f"Meeting '{meeting.title}' starting in 30 minutes"),
            ("15m", timedelta(minutes=15), f"Meeting '{meeting.title}' starting in 15 minutes"),
            ("5m", timedelta(minutes=5), f"Meeting '{meeting.title}' starts in 5 minutes"),
            ("now", timedelta(seconds=0), f"Meeting '{meeting.title}' is starting now"),
        ]

        for uid in target_user_ids:
            for key, delta, msg in offsets:
                remind_at = start_time - delta
                if remind_at > now:
                    try:
                        if uid == user_id:
                            await self.reminder_service.create_reminder(
                                user_id=user_id,
                                payload=ReminderCreate(
                                    meeting_id=meeting.id,
                                    remind_at=remind_at,
                                    message=msg,
                                ),
                            )
                        else:
                            await self.notification_client.schedule_reminder_notification(
                                reminder_id=f"{meeting.id}:{key}:{uid}",
                                user_id=uid,
                                remind_at=remind_at,
                                message=msg,
                            )
                    except Exception:
                        pass
                elif delta == timedelta(seconds=0) and abs((now - start_time).total_seconds()) < 300:
                    try:
                        if uid == user_id:
                            await self.reminder_service.create_reminder(
                                user_id=user_id,
                                payload=ReminderCreate(
                                    meeting_id=meeting.id,
                                    remind_at=now,
                                    message=msg,
                                ),
                            )
                        else:
                            await self.notification_client.schedule_reminder_notification(
                                reminder_id=f"{meeting.id}:{key}:{uid}",
                                user_id=uid,
                                remind_at=now,
                                message=msg,
                            )
                    except Exception:
                        pass



    async def get_meeting(self, user_id: uuid.UUID, meeting_id: uuid.UUID) -> Meeting:
        meeting = await self.meetings.get_by_id(meeting_id)
        if meeting is None:
            raise NotFoundError("Meeting")
        self._assert_owner(meeting, user_id)
        return meeting

    async def list_meetings(
        self,
        user_id: uuid.UUID,
        *,
        offset: int,
        limit: int,
        status: Optional[MeetingStatus] = None,
        starts_after: Optional[datetime] = None,
        starts_before: Optional[datetime] = None,
        overdue_only: Optional[bool] = None,
        missed_only: Optional[bool] = None,
        today_only: Optional[bool] = None,
        upcoming_only: Optional[bool] = None,
    ) -> Tuple[List[Meeting], int]:
        return await self.meetings.list_for_user(
            user_id,
            offset=offset,
            limit=limit,
            status=status,
            starts_after=starts_after,
            starts_before=starts_before,
            overdue_only=overdue_only,
            missed_only=missed_only,
            today_only=today_only,
            upcoming_only=upcoming_only,
        )

    async def update_meeting(
        self, user_id: uuid.UUID, meeting_id: uuid.UUID, payload: MeetingUpdate
    ) -> Meeting:
        meeting = await self.get_meeting(user_id, meeting_id)
        start_time_changed = payload.start_time is not None and payload.start_time != meeting.start_time

        updated = await self.meetings.update(
            meeting,
            title=payload.title,
            description=payload.description,
            location=payload.location,
            start_time=payload.start_time,
            end_time=payload.end_time,
            status=payload.status,
            is_recurring=payload.is_recurring,
            recurrence_rule=payload.recurrence_rule,
        )
        await self.db.commit()

        if start_time_changed:
            await self._schedule_default_meeting_reminders(user_id, updated)

        return updated

    async def cancel_meeting(
        self, user_id: uuid.UUID, meeting_id: uuid.UUID
    ) -> Meeting:
        meeting = await self.get_meeting(user_id, meeting_id)
        updated = await self.meetings.update(meeting, status=MeetingStatus.CANCELLED)
        await self.db.commit()
        return updated

    async def delete_meeting(self, user_id: uuid.UUID, meeting_id: uuid.UUID) -> None:
        meeting = await self.get_meeting(user_id, meeting_id)
        await self.meetings.delete(meeting)
        await self.db.commit()

    async def update_participant_response(
        self,
        user_id: uuid.UUID,
        meeting_id: uuid.UUID,
        participant_id: uuid.UUID,
        response_status: ParticipantResponseStatus,
    ) -> Meeting:
        meeting = await self.get_meeting(user_id, meeting_id)
        participant = await self.meetings.get_participant(meeting_id, participant_id)
        if participant is None:
            raise NotFoundError("Participant")
        await self.meetings.update_participant_response(participant, response_status)
        await self.db.commit()
        return await self.get_meeting(user_id, meeting_id)

    @staticmethod
    def _assert_owner(meeting: Meeting, user_id: uuid.UUID) -> None:
        if meeting.user_id != user_id:
            raise ForbiddenError("You do not have access to this meeting")

