"""Notification ORM model for the notification schema."""
import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, String, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class NotificationStatus(str, enum.Enum):
    PENDING = "pending"
    QUEUED = "queued"
    SENT = "sent"
    CANCELLED = "cancelled"
    FAILED = "failed"


class Notification(Base):
    """A notification scheduled by an upstream service (e.g. core-service).

    `source` + `source_reference_id` identify the originating record
    (e.g. source="core-service", source_reference_id=<reminder id>) so
    that a later re-schedule or cancel call can find and update the
    same row instead of creating duplicates.
    """

    __tablename__ = "notifications"
    __table_args__ = (
        UniqueConstraint(
            "source", "source_reference_id", name="uq_notification_source_ref"
        ),
        {"schema": "notification"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    source: Mapped[str] = mapped_column(String(64), nullable=False)
    source_reference_id: Mapped[str] = mapped_column(String(64), nullable=False)
    message: Mapped[str] = mapped_column(String(1024), nullable=False)
    scheduled_for: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    status: Mapped[NotificationStatus] = mapped_column(
    SAEnum(
        NotificationStatus,
        name="notification_status",
        schema="notification",
        values_callable=lambda enum_cls: [e.value for e in enum_cls],
    ),
    default=NotificationStatus.PENDING,
    nullable=False,
    index=True,
)
    sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_read: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )
    read_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    failure_reason: Mapped[Optional[str]] = mapped_column(
        String(1024), nullable=True
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
        return (
            f"<Notification id={self.id} source={self.source!r} "
            f"status={self.status}>"
        )
