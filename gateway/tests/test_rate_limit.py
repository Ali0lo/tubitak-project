"""Tests for the gateway's rate limiting behavior."""
import httpx
import pytest
from httpx import AsyncClient

from app.config.settings import get_settings

pytestmark = pytest.mark.asyncio


async def test_requests_within_limit_are_allowed(
    gateway_client: AsyncClient, backend_responses: dict
) -> None:
    backend_responses["handler"] = lambda request: httpx.Response(
        200, json={"status": "ok"}
    )
    settings = get_settings()

    for _ in range(min(5, settings.RATE_LIMIT_REQUESTS)):
        response = await gateway_client.post(
            "/api/v1/auth/login",
            json={"email": "a@example.com", "password": "supersecret123"},
        )
        assert response.status_code == 200


async def test_exceeding_rate_limit_returns_429(
    gateway_client: AsyncClient, backend_responses: dict
) -> None:
    backend_responses["handler"] = lambda request: httpx.Response(
        200, json={"status": "ok"}
    )
    settings = get_settings()

    last_response = None
    for _ in range(settings.RATE_LIMIT_REQUESTS + 5):
        last_response = await gateway_client.post(
            "/api/v1/auth/login",
            json={"email": "a@example.com", "password": "supersecret123"},
        )

    assert last_response.status_code == 429
    assert "Retry-After" in last_response.headers
