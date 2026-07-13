"""Data access layer for the ToolCallLog model."""
import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tool_call_log import ToolCallLog, ToolCallStatus


class ToolCallLogRepository:
    """Encapsulates all database access for ToolCallLog rows."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self,
        *,
        message_id: uuid.UUID,
        tool_name: str,
        arguments: dict,
        result: Optional[dict],
        status: ToolCallStatus,
        error_message: Optional[str] = None,
        duration_ms: Optional[int] = None,
    ) -> ToolCallLog:
        log = ToolCallLog(
            message_id=message_id,
            tool_name=tool_name,
            arguments=arguments,
            result=result,
            status=status,
            error_message=error_message,
            duration_ms=duration_ms,
        )
        self.db.add(log)
        await self.db.flush()
        await self.db.refresh(log)
        return log
