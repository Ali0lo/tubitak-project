"""Unit tests for AuthServiceClient.

Uses httpx.MockTransport in place of a real auth-service, so these
run with no database and no real network access.
"""
import os
import uuid

import httpx
import pytest

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-unit-tests-only")
os.environ.setdefault("INTERNAL_SERVICE_API_KEY", "test-internal-key")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/unused"
)

from app.clients.auth_service_client import AuthServiceClient  # noqa: E402

pytestmark = pytest.mark.asyncio


def _client_with_handler(handler) -> AuthServiceClient:
    http_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return AuthServiceClient(
        base_url="http://auth-service:8000", client=http_client
    )


async def test_get_user_email_returns_email_on_success() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"email": "ali@example.com"})

    client = _client_with_handler(handler)
    email = await client.get_user_email(uuid.uuid4())
    assert email == "ali@example.com"


async def test_get_user_email_sends_internal_api_key_header() -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["header"] = request.headers.get("x-internal-api-key")
        return httpx.Response(200, json={"email": "a@example.com"})

    client = _client_with_handler(handler)
    await client.get_user_email(uuid.uuid4())
    assert captured["header"] == "test-internal-key"


async def test_get_user_email_returns_none_on_404() -> None:
    client = _client_with_handler(lambda r: httpx.Response(404))
    email = await client.get_user_email(uuid.uuid4())
    assert email is None


async def test_get_user_email_returns_none_on_connection_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    client = _client_with_handler(handler)
    email = await client.get_user_email(uuid.uuid4())
    assert email is None


async def test_get_user_email_requests_correct_path() -> None:
    captured = {}
    user_id = uuid.uuid4()

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        return httpx.Response(200, json={"email": "x@example.com"})

    client = _client_with_handler(handler)
    await client.get_user_email(user_id)
    assert captured["path"] == f"/api/v1/internal/users/{user_id}"
