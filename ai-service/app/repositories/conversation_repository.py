"""Data access layer for the Conversation model."""
import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.conversation import Conversation


class ConversationRepository:
    """Encapsulates all database access for Conversation rows."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(
        self, conversation_id: uuid.UUID, *, with_messages: bool = False
    ) -> Optional[Conversation]:
        stmt = select(Conversation).where(Conversation.id == conversation_id)
        if with_messages:
            stmt = stmt.options(selectinload(Conversation.messages))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_user(
        self, user_id: uuid.UUID, *, offset: int, limit: int
    ) -> Tuple[List[Conversation], int]:
        stmt = select(Conversation).where(Conversation.user_id == user_id)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = (
            stmt.order_by(Conversation.updated_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def create(
        self, *, user_id: uuid.UUID, title: Optional[str] = None
    ) -> Conversation:
        conversation = Conversation(user_id=user_id, title=title)
        self.db.add(conversation)
        await self.db.flush()
        await self.db.refresh(conversation)
        return conversation

    async def update_title(
        self, conversation: Conversation, title: str
    ) -> Conversation:
        conversation.title = title
        await self.db.flush()
        await self.db.refresh(conversation)
        return conversation

    async def touch(self, conversation: Conversation) -> None:
        """Bump updated_at (e.g. after a new message) without changing content."""
        await self.db.flush()

    async def delete(self, conversation: Conversation) -> None:
        await self.db.delete(conversation)
        await self.db.flush()
