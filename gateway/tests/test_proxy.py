"""Tests for the gateway's reverse-proxy behavior."""
import httpx
import pytest
from httpx import AsyncClient

from tests.conftest import json_body

pytestmark = pytest.mark.asyncio


async def test_proxies_public_auth_route_without_token(
    gateway_client: AsyncClient, backend_responses: dict
) -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["body"] = json_body(request)
        return httpx.Response(201, json={"id": "abc123"})

    backend_responses["handler"] = handler

    response = await gateway_client.post(
        "/api/v1/auth/register",
        json={"email": "a@example.com", "password": "supersecret123"},
    )
    assert response.status_code == 201
    assert response.json() == {"id": "abc123"}
    assert "auth-service" in captured["url"]
    assert captured["body"]["email"] == "a@example.com"


async def test_protected_route_without_token_is_rejected(
    gateway_client: AsyncClient,
) -> None:
    response = await gateway_client.get("/api/v1/tasks")
    assert response.status_code == 401


async def test_protected_route_with_token_is_forwarded(
    gateway_client: AsyncClient, backend_responses: dict
) -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["auth_header"] = request.headers.get("authorization")
        captured["path"] = request.url.path
        return httpx.Response(200, json={"items": [], "total": 0})

    backend_responses["handler"] = handler

    response = await gateway_client.get(
        "/api/v1/tasks", headers={"Authorization": "Bearer faketoken123"}
    )
    assert response.status_code == 200
    assert captured["auth_header"] == "Bearer faketoken123"
    assert captured["path"] == "/api/v1/tasks"


async def test_routes_tasks_and_meetings_to_core_service(
    gateway_client: AsyncClient, backend_responses: dict
) -> None:
    captured_urls = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured_urls.append(str(request.url))
        return httpx.Response(200, json={})

    backend_responses["handler"] = handler
    headers = {"Authorization": "Bearer faketoken123"}

    await gateway_client.get("/api/v1/tasks", headers=headers)
    await gateway_client.get("/api/v1/meetings", headers=headers)
    await gateway_client.get("/api/v1/reminders", headers=headers)

    assert all("core-service" in url for url in captured_urls)


async def test_unknown_route_returns_404(gateway_client: AsyncClient) -> None:
    response = await gateway_client.get(
        "/api/v1/nonexistent-service/whatever",
        headers={"Authorization": "Bearer faketoken123"},
    )
    assert response.status_code == 404


async def test_downstream_failure_returns_503(
    gateway_client: AsyncClient, backend_responses: dict
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused", request=request)

    backend_responses["handler"] = handler

    response = await gateway_client.get(
        "/api/v1/tasks", headers={"Authorization": "Bearer faketoken123"}
    )
    assert response.status_code == 503


async def test_downstream_status_code_is_passed_through(
    gateway_client: AsyncClient, backend_responses: dict
) -> None:
    backend_responses["handler"] = lambda request: httpx.Response(
        404, json={"detail": "Task not found"}
    )

    response = await gateway_client.get(
        "/api/v1/tasks/00000000-0000-0000-0000-000000000000",
        headers={"Authorization": "Bearer faketoken123"},
    )
    assert response.status_code == 404
    assert response.json() == {"detail": "Task not found"}


async def test_query_params_are_forwarded(
    gateway_client: AsyncClient, backend_responses: dict
) -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["query"] = dict(request.url.params)
        return httpx.Response(200, json={"items": [], "total": 0})

    backend_responses["handler"] = handler

    await gateway_client.get(
        "/api/v1/tasks",
        params={"status": "completed", "page": "2"},
        headers={"Authorization": "Bearer faketoken123"},
    )
    assert captured["query"] == {"status": "completed", "page": "2"}
