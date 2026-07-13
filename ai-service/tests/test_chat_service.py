"""Integration tests for ChatService's agent loop.

Requires TEST_DATABASE_URL (see conftest.py). The OpenAI and
core-service calls are both faked, so no external network access is
needed even though the database is real.
"""
import uuid

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.core_service_client import CoreServiceClient
from app.clients.openai_client import ChatCompletionResult, ToolCallRequest
from app.core.exceptions import AgentLoopLimitError, ForbiddenError, NotFoundError
from app.models.message import MessageRole
from app.models.tool_call_log import ToolCallStatus
from app.services.chat_service import ChatService
from app.tools.executor import ToolExecutor
from tests.conftest import FakeOpenAIClient

pytestmark = pytest.mark.asyncio


def _core_client_with_handler(handler) -> CoreServiceClient:
    http_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return CoreServiceClient(
        base_url="http://core-service:8000", client=http_client
    )


async def test_simple_reply_with_no_tool_calls(db_session: AsyncSession) -> None:
    fake_openai = FakeOpenAIClient(
        [ChatCompletionResult(content="Hi! How can I help?", tool_calls=[])]
    )
    tool_executor = ToolExecutor(
        _core_client_with_handler(lambda r: httpx.Response(200, json={}))
    )
    service = ChatService(db_session, fake_openai, tool_executor)
    user_id = uuid.uuid4()

    conversation, final_message, tool_messages = await service.send_message(
        user_id, "fake-token", None, "Hello there"
    )

    assert conversation.user_id == user_id
    assert final_message.role == MessageRole.ASSISTANT
    assert final_message.content == "Hi! How can I help?"
    assert tool_messages == []
    assert len(fake_openai.calls) == 1


async def test_conversation_title_set_from_first_message(
    db_session: AsyncSession,
) -> None:
    fake_openai = FakeOpenAIClient(
        [ChatCompletionResult(content="Sure thing.", tool_calls=[])]
    )
    tool_executor = ToolExecutor(
        _core_client_with_handler(lambda r: httpx.Response(200, json={}))
    )
    service = ChatService(db_session, fake_openai, tool_executor)

    conversation, _, _ = await service.send_message(
        uuid.uuid4(), "fake-token", None, "Remind me to call the bank tomorrow"
    )

    assert conversation.title == "Remind me to call the bank tomorrow"


async def test_tool_call_is_executed_and_looped_back(
    db_session: AsyncSession,
) -> None:
    fake_openai = FakeOpenAIClient(
        [
            ChatCompletionResult(
                content=None,
                tool_calls=[
                    ToolCallRequest(
                        id="call_1",
                        name="create_task",
                        arguments={"title": "Buy milk"},
                    )
                ],
            ),
            ChatCompletionResult(
                content="I've added 'Buy milk' to your tasks.", tool_calls=[]
            ),
        ]
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            201, json={"id": "task-123", "title": "Buy milk"}
        )

    tool_executor = ToolExecutor(_core_client_with_handler(handler))
    service = ChatService(db_session, fake_openai, tool_executor)

    conversation, final_message, tool_messages = await service.send_message(
        uuid.uuid4(), "fake-token", None, "Add buy milk to my tasks"
    )

    assert final_message.content == "I've added 'Buy milk' to your tasks."
    assert len(tool_messages) == 1
    assert tool_messages[0].role == MessageRole.TOOL
    assert tool_messages[0].tool_call_id == "call_1"
    assert "task-123" in tool_messages[0].content
    # The OpenAI client should have been called twice: once producing
    # the tool call, once producing the final reply after the tool
    # result was appended to history.
    assert len(fake_openai.calls) == 2
    second_call_messages = fake_openai.calls[1]["messages"]
    assert any(m.get("role") == "tool" for m in second_call_messages)


async def test_tool_call_failure_is_surfaced_to_model_not_raised(
    db_session: AsyncSession,
) -> None:
    fake_openai = FakeOpenAIClient(
        [
            ChatCompletionResult(
                content=None,
                tool_calls=[
                    ToolCallRequest(
                        id="call_1",
                        name="delete_task",
                        arguments={"task_id": "missing"},
                    )
                ],
            ),
            ChatCompletionResult(
                content="I couldn't find that task.", tool_calls=[]
            ),
        ]
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"detail": "Task not found"})

    tool_executor = ToolExecutor(_core_client_with_handler(handler))
    service = ChatService(db_session, fake_openai, tool_executor)

    conversation, final_message, tool_messages = await service.send_message(
        uuid.uuid4(), "fake-token", None, "Delete task missing"
    )

    assert final_message.content == "I couldn't find that task."
    assert "Task not found" in tool_messages[0].content


async def test_continuing_existing_conversation(db_session: AsyncSession) -> None:
    fake_openai = FakeOpenAIClient(
        [
            ChatCompletionResult(content="First reply", tool_calls=[]),
            ChatCompletionResult(content="Second reply", tool_calls=[]),
        ]
    )
    tool_executor = ToolExecutor(
        _core_client_with_handler(lambda r: httpx.Response(200, json={}))
    )
    service = ChatService(db_session, fake_openai, tool_executor)
    user_id = uuid.uuid4()

    conversation, _, _ = await service.send_message(
        user_id, "fake-token", None, "First message"
    )
    conversation_again, final_message, _ = await service.send_message(
        user_id, "fake-token", conversation.id, "Second message"
    )

    assert conversation_again.id == conversation.id
    assert final_message.content == "Second reply"
    # Second OpenAI call should include the full prior history.
    second_call_messages = fake_openai.calls[1]["messages"]
    contents = [m.get("content") for m in second_call_messages]
    assert "First message" in contents
    assert "First reply" in contents


async def test_accessing_another_users_conversation_is_forbidden(
    db_session: AsyncSession,
) -> None:
    fake_openai = FakeOpenAIClient(
        [ChatCompletionResult(content="reply", tool_calls=[])]
    )
    tool_executor = ToolExecutor(
        _core_client_with_handler(lambda r: httpx.Response(200, json={}))
    )
    service = ChatService(db_session, fake_openai, tool_executor)

    owner_id = uuid.uuid4()
    conversation, _, _ = await service.send_message(
        owner_id, "fake-token", None, "hello"
    )

    other_openai = FakeOpenAIClient([])
    other_service = ChatService(db_session, other_openai, tool_executor)
    with pytest.raises(ForbiddenError):
        await other_service.send_message(
            uuid.uuid4(), "fake-token", conversation.id, "hi"
        )


async def test_nonexistent_conversation_raises_not_found(
    db_session: AsyncSession,
) -> None:
    fake_openai = FakeOpenAIClient([])
    tool_executor = ToolExecutor(
        _core_client_with_handler(lambda r: httpx.Response(200, json={}))
    )
    service = ChatService(db_session, fake_openai, tool_executor)

    with pytest.raises(NotFoundError):
        await service.send_message(
            uuid.uuid4(), "fake-token", uuid.uuid4(), "hi"
        )


async def test_exceeding_max_tool_iterations_raises(
    db_session: AsyncSession,
) -> None:
    settings_module = __import__(
        "app.core.config", fromlist=["get_settings"]
    )
    max_iterations = settings_module.get_settings().MAX_TOOL_ITERATIONS

    endless_tool_call = ChatCompletionResult(
        content=None,
        tool_calls=[
            ToolCallRequest(id="call_x", name="list_tasks", arguments={})
        ],
    )
    fake_openai = FakeOpenAIClient([endless_tool_call] * max_iterations)
    tool_executor = ToolExecutor(
        _core_client_with_handler(
            lambda r: httpx.Response(200, json={"items": [], "total": 0})
        )
    )
    service = ChatService(db_session, fake_openai, tool_executor)

    with pytest.raises(AgentLoopLimitError):
        await service.send_message(
            uuid.uuid4(), "fake-token", None, "loop forever please"
        )
