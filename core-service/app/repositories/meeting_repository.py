"""Data access layer for the Meeting and MeetingParticipant models."""
import uuid
from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.meeting import (
    Meeting,
    MeetingParticipant,
    MeetingStatus,
    ParticipantResponseStatus,
)


class MeetingRepository:
    """Encapsulates all database access for Meeting rows."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(
        self, meeting_id: uuid.UUID, *, with_participants: bool = True
    ) -> Optional[Meeting]:
        stmt = select(Meeting).where(Meeting.id == meeting_id)
        if with_participants:
            stmt = stmt.options(selectinload(Meeting.participants))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        *,
        offset: int,
        limit: int,
        status: Optional[MeetingStatus] = None,
        starts_after: Optional[datetime] = None,
        starts_before: Optional[datetime] = None,
    ) -> Tuple[List[Meeting], int]:
        stmt = select(Meeting).where(Meeting.user_id == user_id)

        if status is not None:
            stmt = stmt.where(Meeting.status == status)
        if starts_after is not None:
            stmt = stmt.where(Meeting.start_time >= starts_after)
        if starts_before is not None:
            stmt = stmt.where(Meeting.start_time <= starts_before)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = (
            stmt.options(selectinload(Meeting.participants))
            .order_by(Meeting.start_time.asc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        items = list(result.unique().scalars().all())
        return items, total

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        title: str,
        description: Optional[str],
        location: Optional[str],
        start_time: datetime,
        end_time: datetime,
        participants: List[Tuple[str, Optional[str]]],
    ) -> Meeting:
        meeting = Meeting(
            user_id=user_id,
            title=title,
            description=description,
            location=location,
            start_time=start_time,
            end_time=end_time,
        )
        meeting.participants = [
            MeetingParticipant(email=email, name=name)
            for email, name in participants
        ]
        self.db.add(meeting)
        await self.db.flush()
        await self.db.refresh(meeting, attribute_names=["participants"])
        return meeting

    async def update(
        self,
        meeting: Meeting,
        *,
        title: Optional[str] = None,
        description: Optional[str] = None,
        location: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        status: Optional[MeetingStatus] = None,
    ) -> Meeting:
        if title is not None:
            meeting.title = title
        if description is not None:
            meeting.description = description
        if location is not None:
            meeting.location = location
        if start_time is not None:
            meeting.start_time = start_time
        if end_time is not None:
            meeting.end_time = end_time
        if status is not None:
            meeting.status = status
        await self.db.flush()
        await self.db.refresh(meeting, attribute_names=["participants"])
        return meeting

    async def delete(self, meeting: Meeting) -> None:
        await self.db.delete(meeting)
        await self.db.flush()

    async def get_participant(
        self, meeting_id: uuid.UUID, participant_id: uuid.UUID
    ) -> Optional[MeetingParticipant]:
        result = await self.db.execute(
            select(MeetingParticipant).where(
                MeetingParticipant.id == participant_id,
                MeetingParticipant.meeting_id == meeting_id,
            )
        )
        return result.scalar_one_or_none()

    async def update_participant_response(
        self,
        participant: MeetingParticipant,
        response_status: ParticipantResponseStatus,
    ) -> MeetingParticipant:
        participant.response_status = response_status
        await self.db.flush()
        await self.db.refresh(participant)
        return participant
