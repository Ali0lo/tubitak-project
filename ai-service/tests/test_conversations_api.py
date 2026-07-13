"""Integration tests for the conversation API.

Requires TEST_DATABASE_URL (see conftest.py).
"""
import uuid

import httpx
import pytest
from httpx import AsyncClient

from app.clients.core_service_client import CoreServiceClient
from app.clients.openai_client import ChatCompletionResult
from app.services.chat_service import ChatService
from app.tools.executor import ToolExecutor
from tests.conftest import FakeOpenAIClient

pytestmark = pytest.mark.asyncio


async def _seed_conversation(db_session, user_id: uuid.UUID, text: str = "Hello"):
    fake_openai = FakeOpenAIClient(
        [ChatCompletionResult(content="Hi there!", tool_calls=[])]
    )
    core_client = CoreServiceClient(
        base_url="http://core-service:8000",
        client=httpx.AsyncClient(
            transport=httpx.MockTransport(lambda r: httpx.Response(200, json={}))
        ),
    )
    service = ChatService(db_session, fake_openai, ToolExecutor(core_client))
    conversation, _, _ = await service.send_message(
        user_id, "fake-token", None, text
    )
    return conversation


async def test_list_conversations_requires_auth(app_client: AsyncClient) -> None:
    response = await app_client.get("/api/v1/ai/conversations")
    assert response.status_code == 401


async def test_list_conversations_empty(
    app_client: AsyncClient, auth_headers: dict
) -> None:
    response = await app_client.get(
        "/api/v1/ai/conversations", headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


async def test_get_conversation_includes_messages(
    app_client: AsyncClient, db_session, test_user_id, auth_headers: dict
) -> None:
    conversation = await _seed_conversation(db_session, test_user_id)

    response = await app_client.get(
        f"/api/v1/ai/conversations/{conversation.id}", headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(conversation.id)
    roles = [m["role"] for m in body["messages"]]
    assert roles == ["user", "assistant"]


async def test_get_conversation_not_found(
    app_client: AsyncClient, auth_headers: dict
) -> None:
    response = await app_client.get(
        f"/api/v1/ai/conversations/{uuid.uuid4()}", headers=auth_headers
    )
    assert response.status_code == 404


async def test_get_other_users_conversation_is_forbidden(
    app_client: AsyncClient, db_session, auth_headers: dict
) -> None:
    other_user_id = uuid.uuid4()
    conversation = await _seed_conversation(db_session, other_user_id)

    response = await app_client.get(
        f"/api/v1/ai/conversations/{conversation.id}", headers=auth_headers
    )
    assert response.status_code == 403


async def test_update_conversation_title(
    app_client: AsyncClient, db_session, test_user_id, auth_headers: dict
) -> None:
    conversation = await _seed_conversation(db_session, test_user_id)

    response = await app_client.patch(
        f"/api/v1/ai/conversations/{conversation.id}",
        json={"title": "Renamed"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Renamed"


async def test_delete_conversation(
    app_client: AsyncClient, db_session, test_user_id, auth_headers: dict
) -> None:
    conversation = await _seed_conversation(db_session, test_user_id)

    delete_response = await app_client.delete(
        f"/api/v1/ai/conversations/{conversation.id}", headers=auth_headers
    )
    assert delete_response.status_code == 204

    get_response = await app_client.get(
        f"/api/v1/ai/conversations/{conversation.id}", headers=auth_headers
    )
    assert get_response.status_code == 404
