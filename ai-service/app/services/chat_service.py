"""The core agentic loop: user message in, tool calls resolved, final reply out.

This is the primary interface to Todotak's functionality per the
product's design — the model decides which of the registered tools
(create_task, list_meetings, etc.) to call based on the user's
natural-language request, and this service drives that loop, persists
every message and tool call for auditability, and returns the final
assistant reply.
"""
from datetime import datetime, timezone
import json
import time
import uuid
from typing import List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.openai_client import OpenAIClient, ToolCallRequest
from app.core.config import get_settings
from app.core.exceptions import (
    AgentLoopLimitError,
    AIServiceError,
    ForbiddenError,
    NotFoundError,
)
from app.models.conversation import Conversation
from app.models.message import Message, MessageRole
from app.models.tool_call_log import ToolCallStatus
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.message_repository import MessageRepository
from app.repositories.tool_call_log_repository import ToolCallLogRepository
from app.tools.definitions import TOOL_DEFINITIONS
from app.tools.executor import ToolContext, ToolExecutor

SYSTEM_PROMPT = (
    "You are Todotak's AI assistant. You help the user manage their "
    "tasks, meetings, and reminders entirely through natural "
    "conversation. Use the available tools to create, list, update, "
    "or delete tasks and meetings, and to set reminders, whenever the "
    "user's request calls for it. Always confirm what you did in "
    "plain language after a tool call succeeds. If a tool call fails, "
    "explain the problem to the user without exposing raw error "
    "details, and suggest what they might try instead. Ask a "
    "clarifying question only when you genuinely cannot proceed "
    "without more information."
)


def _message_to_openai_dict(message: Message) -> dict:
    entry: dict = {"role": message.role.value, "content": message.content}
    if message.tool_calls:
        entry["tool_calls"] = message.tool_calls
    if message.tool_call_id:
        entry["tool_call_id"] = message.tool_call_id
    return entry


class ChatService:
    """Drives one user turn through the tool-calling agent loop."""

    def __init__(
        self,
        db: AsyncSession,
        openai_client: OpenAIClient,
        tool_executor: ToolExecutor,
    ) -> None:
        self.db = db
        self.conversations = ConversationRepository(db)
        self.messages = MessageRepository(db)
        self.tool_logs = ToolCallLogRepository(db)
        self.openai_client = openai_client
        self.tool_executor = tool_executor
        self.settings = get_settings()

    async def send_message(
        self,
        user_id: uuid.UUID,
        access_token: str,
        conversation_id: Optional[uuid.UUID],
        content: str,
    ) -> Tuple[Conversation, Message, List[Message]]:
        conversation = await self._get_or_create_conversation(
            user_id, conversation_id
        )
        await self.messages.create(
            conversation_id=conversation.id,
            role=MessageRole.USER,
            content=content,
        )
        await self.db.commit()

        context = ToolContext(user_id=user_id, access_token=access_token)
        tool_messages: List[Message] = []

        history = await self.messages.list_for_conversation(
            conversation.id, limit=self.settings.MAX_CONVERSATION_HISTORY_MESSAGES
        )
        now_utc = datetime.now(timezone.utc)
        now_local = datetime.now().astimezone()
        now_str = f"{now_utc.strftime('%Y-%m-%d %H:%M:%S UTC')} / Local: {now_local.strftime('%Y-%m-%d %H:%M:%S %z (%A)')}"
        system_content = (
            f"{SYSTEM_PROMPT}\n"
            f"Current date and time: {now_str}. "
            "Use this as reference when resolving relative dates like 'today', 'tomorrow', 'next week', or specific clock times. Ensure tool call timestamps specify ISO string with timezone or UTC offset."
        )
        openai_messages: List[dict] = [
            {"role": "system", "content": system_content}
        ] + [_message_to_openai_dict(m) for m in history]

        for _ in range(self.settings.MAX_TOOL_ITERATIONS):
            result = await self.openai_client.complete(
                messages=openai_messages, tools=TOOL_DEFINITIONS
            )

            if result.tool_calls:
                tool_call_dicts = [
                    {
                        "id": call.id,
                        "type": "function",
                        "function": {
                            "name": call.name,
                            "arguments": json.dumps(call.arguments),
                        },
                    }
                    for call in result.tool_calls
                ]
                assistant_message = await self.messages.create(
                    conversation_id=conversation.id,
                    role=MessageRole.ASSISTANT,
                    content=result.content,
                    tool_calls=tool_call_dicts,
                )
                await self.db.commit()
                openai_messages.append(_message_to_openai_dict(assistant_message))

                for call in result.tool_calls:
                    tool_result, status, error_message, duration_ms = (
                        await self._run_tool(call, context)
                    )

                    tool_message = await self.messages.create(
                        conversation_id=conversation.id,
                        role=MessageRole.TOOL,
                        content=json.dumps(tool_result, default=str),
                        tool_call_id=call.id,
                    )
                    await self.tool_logs.create(
                        message_id=assistant_message.id,
                        tool_name=call.name,
                        arguments=call.arguments,
                        result=tool_result if status == ToolCallStatus.SUCCESS else None,
                        status=status,
                        error_message=error_message,
                        duration_ms=duration_ms,
                    )
                    await self.db.commit()

                    tool_messages.append(tool_message)
                    openai_messages.append(_message_to_openai_dict(tool_message))

                continue

            final_message = await self.messages.create(
                conversation_id=conversation.id,
                role=MessageRole.ASSISTANT,
                content=result.content or "",
            )
            await self._maybe_set_title(conversation, content)
            await self.db.commit()
            return conversation, final_message, tool_messages

        raise AgentLoopLimitError()

    async def _run_tool(
        self, call: ToolCallRequest, context: ToolContext
    ) -> Tuple[dict, ToolCallStatus, Optional[str], int]:
        start = time.perf_counter()
        try:
            tool_result = await self.tool_executor.execute(
                call.name, call.arguments, context
            )
            status = ToolCallStatus.SUCCESS
            error_message = None
        except AIServiceError as exc:
            tool_result = {"error": exc.message}
            status = ToolCallStatus.ERROR
            error_message = exc.message
        duration_ms = int((time.perf_counter() - start) * 1000)
        return tool_result, status, error_message, duration_ms

    async def _get_or_create_conversation(
        self, user_id: uuid.UUID, conversation_id: Optional[uuid.UUID]
    ) -> Conversation:
        if conversation_id is not None:
            conversation = await self.conversations.get_by_id(conversation_id)
            if conversation is None:
                raise NotFoundError("Conversation")
            if conversation.user_id != user_id:
                raise ForbiddenError(
                    "You do not have access to this conversation"
                )
            return conversation

        conversation = await self.conversations.create(user_id=user_id)
        await self.db.commit()
        return conversation

    async def _maybe_set_title(
        self, conversation: Conversation, first_user_message: str
    ) -> None:
        if conversation.title is None:
            title = first_user_message.strip()[:80]
            await self.conversations.update_title(conversation, title)
