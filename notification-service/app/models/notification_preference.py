"""NotificationPreference ORM model for the notification schema."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class NotificationPreference(Base):
    """Per-user opt-in/out settings for notification channels.

    In-app notifications (the stored Notification rows themselves,
    surfaced via GET /api/v1/notifications) are always on — there's no
    separate delivery step for them. This only controls whether an
    email is additionally sent.
    """

    __tablename__ = "notification_preferences"
    __table_args__ = {"schema": "notification"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, nullable=False, index=True
    )
    email_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
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
            f"<NotificationPreference user_id={self.user_id} "
            f"email_enabled={self.email_enabled}>"
        )
