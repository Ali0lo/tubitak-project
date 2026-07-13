"""Tests for gateway health endpoints."""
import httpx
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_gateway_health(gateway_client: AsyncClient) -> None:
    response = await gateway_client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "gateway"


async def test_gateway_health_is_not_rate_limited(
    gateway_client: AsyncClient,
) -> None:
    for _ in range(150):
        response = await gateway_client.get("/health")
        assert response.status_code == 200


async def test_aggregated_health_all_services_ok(
    gateway_client: AsyncClient, backend_responses: dict
) -> None:
    backend_responses["handler"] = lambda request: httpx.Response(
        200, json={"status": "ok"}
    )
    response = await gateway_client.get("/health/services")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert set(body["services"].keys()) == {
        "auth-service",
        "core-service",
        "ai-service",
        "notification-service",
    }
    assert all(v == "ok" for v in body["services"].values())


async def test_aggregated_health_reports_degraded_service(
    gateway_client: AsyncClient, backend_responses: dict
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if "auth-service" in str(request.url):
            return httpx.Response(500)
        return httpx.Response(200, json={"status": "ok"})

    backend_responses["handler"] = handler
    response = await gateway_client.get("/health/services")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "degraded"
    assert body["services"]["auth-service"] == "degraded"
