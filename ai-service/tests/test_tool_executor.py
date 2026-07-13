"""Unit tests for ToolExecutor.

Uses a CoreServiceClient backed by httpx.MockTransport, so these tests
run with no database and no real network access.
"""
import os
import uuid

import httpx
import pytest

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-unit-tests-only")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/unused"
)

from app.clients.core_service_client import CoreServiceClient  # noqa: E402
from app.core.exceptions import UnknownToolError  # noqa: E402
from app.tools.executor import ToolContext, ToolExecutor  # noqa: E402

pytestmark = pytest.mark.asyncio


def _executor_with_handler(handler) -> ToolExecutor:
    mock_transport = httpx.MockTransport(handler)
    http_client = httpx.AsyncClient(transport=mock_transport)
    core_client = CoreServiceClient(
        base_url="http://core-service:8000", client=http_client
    )
    return ToolExecutor(core_client)


@pytest.fixture
def context() -> ToolContext:
    return ToolContext(user_id=uuid.uuid4(), access_token="fake-token")


async def test_execute_create_task_returns_core_service_response(
    context: ToolContext,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(201, json={"id": "task-1", "title": "Buy milk"})

    executor = _executor_with_handler(handler)
    result = await executor.execute(
        "create_task", {"title": "Buy milk"}, context
    )
    assert result == {"id": "task-1", "title": "Buy milk"}


async def test_execute_delete_task_returns_status_dict(
    context: ToolContext,
) -> None:
    executor = _executor_with_handler(lambda request: httpx.Response(204))
    result = await executor.execute(
        "delete_task", {"task_id": "task-1"}, context
    )
    assert result == {"status": "deleted", "task_id": "task-1"}


async def test_execute_unknown_tool_raises(context: ToolContext) -> None:
    executor = _executor_with_handler(lambda request: httpx.Response(200))
    with pytest.raises(UnknownToolError):
        await executor.execute("not_a_real_tool", {}, context)


async def test_execute_forwards_access_token_from_context() -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["auth"] = request.headers.get("authorization")
        return httpx.Response(200, json={"items": [], "total": 0})

    executor = _executor_with_handler(handler)
    ctx = ToolContext(user_id=uuid.uuid4(), access_token="specific-token-abc")
    await executor.execute("list_tasks", {}, ctx)

    assert captured["auth"] == "Bearer specific-token-abc"


async def test_execute_create_meeting_passes_participants(
    context: ToolContext,
) -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = request.content
        return httpx.Response(201, json={"id": "meeting-1"})

    executor = _executor_with_handler(handler)
    await executor.execute(
        "create_meeting",
        {
            "title": "Sync",
            "start_time": "2026-08-01T10:00:00Z",
            "end_time": "2026-08-01T11:00:00Z",
            "participants": [{"email": "a@example.com"}],
        },
        context,
    )
    assert b"a@example.com" in captured["body"]
