"""ToolCallLog ORM model for the ai schema."""
import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ToolCallStatus(str, enum.Enum):
    SUCCESS = "success"
    ERROR = "error"


class ToolCallLog(Base):
    """An audit record of a single tool invocation made by the agent."""

    __tablename__ = "tool_call_logs"
    __table_args__ = {"schema": "ai"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai.messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tool_name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    arguments: Mapped[dict] = mapped_column(JSONB, nullable=False)
    result: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    status: Mapped[ToolCallStatus] = mapped_column(
    SAEnum(
        ToolCallStatus,
        name="tool_call_status",
        schema="ai",
        values_callable=lambda enum_cls: [e.value for e in enum_cls],
    ),
    nullable=False,
)
    error_message: Mapped[Optional[str]] = mapped_column(
        String(1024), nullable=True
    )
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )

    message: Mapped["Message"] = relationship(back_populates="tool_call_logs")

    def __repr__(self) -> str:
        return (
            f"<ToolCallLog id={self.id} tool_name={self.tool_name!r} "
            f"status={self.status}>"
        )
