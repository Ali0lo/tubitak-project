"""Business logic for conversation management."""
import uuid
from typing import List, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.conversation import Conversation
from app.repositories.conversation_repository import ConversationRepository
from app.schemas.conversation import ConversationUpdate


class ConversationService:
    """Orchestrates conversation use cases, enforcing ownership rules."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.conversations = ConversationRepository(db)

    async def get_conversation(
        self, user_id: uuid.UUID, conversation_id: uuid.UUID
    ) -> Conversation:
        conversation = await self.conversations.get_by_id(
            conversation_id, with_messages=True
        )
        if conversation is None:
            raise NotFoundError("Conversation")
        self._assert_owner(conversation, user_id)
        return conversation

    async def list_conversations(
        self, user_id: uuid.UUID, *, offset: int, limit: int
    ) -> Tuple[List[Conversation], int]:
        return await self.conversations.list_for_user(
            user_id, offset=offset, limit=limit
        )

    async def update_conversation(
        self,
        user_id: uuid.UUID,
        conversation_id: uuid.UUID,
        payload: ConversationUpdate,
    ) -> Conversation:
        conversation = await self.conversations.get_by_id(conversation_id)
        if conversation is None:
            raise NotFoundError("Conversation")
        self._assert_owner(conversation, user_id)
        if payload.title is not None:
            conversation = await self.conversations.update_title(
                conversation, payload.title
            )
        await self.db.commit()
        return conversation

    async def delete_conversation(
        self, user_id: uuid.UUID, conversation_id: uuid.UUID
    ) -> None:
        conversation = await self.conversations.get_by_id(conversation_id)
        if conversation is None:
            raise NotFoundError("Conversation")
        self._assert_owner(conversation, user_id)
        await self.conversations.delete(conversation)
        await self.db.commit()

    @staticmethod
    def _assert_owner(conversation: Conversation, user_id: uuid.UUID) -> None:
        if conversation.user_id != user_id:
            raise ForbiddenError("You do not have access to this conversation")
