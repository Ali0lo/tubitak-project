"""Data access layer for the Message model."""
import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message, MessageRole


class MessageRepository:
    """Encapsulates all database access for Message rows."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_for_conversation(
        self, conversation_id: uuid.UUID, *, limit: Optional[int] = None
    ) -> List[Message]:
        stmt = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
        )
        result = await self.db.execute(stmt)
        messages = list(result.scalars().all())
        if limit is not None and len(messages) > limit:
            return messages[-limit:]
        return messages

    async def create(
        self,
        *,
        conversation_id: uuid.UUID,
        role: MessageRole,
        content: Optional[str] = None,
        tool_calls: Optional[List[dict]] = None,
        tool_call_id: Optional[str] = None,
    ) -> Message:
        message = Message(
            conversation_id=conversation_id,
            role=role,
            content=content,
            tool_calls=tool_calls,
            tool_call_id=tool_call_id,
        )
        self.db.add(message)
        await self.db.flush()
        await self.db.refresh(message)
        return message
