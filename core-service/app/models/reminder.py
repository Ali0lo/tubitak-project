"""Reminder ORM model for the core schema."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Reminder(Base):
    """A scheduled reminder, optionally tied to a task or meeting.

    A reminder may stand alone (both task_id and meeting_id null), or
    be attached to exactly one of a task or a meeting. That invariant
    is enforced in ReminderService rather than at the DB level, since
    it is a business rule rather than a structural constraint.
    """

    __tablename__ = "reminders"
    __table_args__ = {"schema": "core"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    task_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core.tasks.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    meeting_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core.meetings.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    remind_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    message: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    is_sent: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        onupdate=_utcnow,
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Reminder id={self.id} remind_at={self.remind_at} is_sent={self.is_sent}>"
