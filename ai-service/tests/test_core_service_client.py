"""Unit tests for CoreServiceClient.

These use httpx.MockTransport to stand in for core-service, so they
run with no database and no real network access.
"""
import os

import httpx
import pytest

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-unit-tests-only")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/unused"
)

from app.clients.core_service_client import CoreServiceClient  # noqa: E402
from app.core.exceptions import ToolExecutionError  # noqa: E402

pytestmark = pytest.mark.asyncio

FAKE_TOKEN = "fake-access-token"


def _client_with_handler(handler) -> CoreServiceClient:
    mock_transport = httpx.MockTransport(handler)
    http_client = httpx.AsyncClient(transport=mock_transport)
    return CoreServiceClient(
        base_url="http://core-service:8000", client=http_client
    )


async def test_create_task_sends_expected_request() -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["method"] = request.method
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("authorization")
        captured["body"] = request.content
        return httpx.Response(201, json={"id": "task-1", "title": "Buy milk"})

    client = _client_with_handler(handler)
    result = await client.create_task(FAKE_TOKEN, title="Buy milk")

    assert result == {"id": "task-1", "title": "Buy milk"}
    assert captured["method"] == "POST"
    assert captured["url"] == "http://core-service:8000/api/v1/tasks"
    assert captured["auth"] == f"Bearer {FAKE_TOKEN}"
    assert b'"title"' in captured["body"] and b'"Buy milk"' in captured["body"]


async def test_list_tasks_sends_query_params() -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["query"] = dict(request.url.params)
        return httpx.Response(200, json={"items": [], "total": 0})

    client = _client_with_handler(handler)
    await client.list_tasks(FAKE_TOKEN, status="completed", tag="work")

    assert captured["query"]["status"] == "completed"
    assert captured["query"]["tag"] == "work"


async def test_delete_task_returns_none_on_204() -> None:
    client = _client_with_handler(lambda request: httpx.Response(204))
    result = await client.delete_task(FAKE_TOKEN, "task-1")
    assert result is None


async def test_error_response_raises_tool_execution_error_with_detail() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"detail": "Task not found"})

    client = _client_with_handler(handler)
    with pytest.raises(ToolExecutionError) as exc_info:
        await client.update_task(FAKE_TOKEN, "missing-id", title="New title")

    assert "Task not found" in str(exc_info.value)


async def test_connection_failure_raises_tool_execution_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused", request=request)

    client = _client_with_handler(handler)
    with pytest.raises(ToolExecutionError):
        await client.list_meetings(FAKE_TOKEN)


async def test_create_reminder_omits_unset_optional_fields() -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = request.content
        return httpx.Response(201, json={"id": "reminder-1"})

    client = _client_with_handler(handler)
    await client.create_reminder(FAKE_TOKEN, remind_at="2026-08-01T10:00:00Z")

    assert b"task_id" not in captured["body"]
    assert b"meeting_id" not in captured["body"]
