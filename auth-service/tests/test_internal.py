"""Integration tests for the internal, service-to-service user-lookup route.

Requires TEST_DATABASE_URL (see conftest.py).
"""
import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

REGISTER_PAYLOAD = {
    "email": "lookup-target@example.com",
    "full_name": "Lookup Target",
    "password": "supersecret123",
}


async def test_lookup_requires_internal_api_key(client: AsyncClient) -> None:
    register_response = await client.post(
        "/api/v1/auth/register", json=REGISTER_PAYLOAD
    )
    user_id = register_response.json()["id"]

    response = await client.get(f"/api/v1/internal/users/{user_id}")
    assert response.status_code == 401


async def test_lookup_rejects_wrong_internal_api_key(client: AsyncClient) -> None:
    register_response = await client.post(
        "/api/v1/auth/register", json=REGISTER_PAYLOAD
    )
    user_id = register_response.json()["id"]

    response = await client.get(
        f"/api/v1/internal/users/{user_id}",
        headers={"X-Internal-Api-Key": "wrong-key"},
    )
    assert response.status_code == 401


async def test_lookup_returns_user_with_valid_key(
    client: AsyncClient, internal_headers: dict
) -> None:
    register_response = await client.post(
        "/api/v1/auth/register", json=REGISTER_PAYLOAD
    )
    user_id = register_response.json()["id"]

    response = await client.get(
        f"/api/v1/internal/users/{user_id}", headers=internal_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == REGISTER_PAYLOAD["email"]
    assert "hashed_password" not in body


async def test_lookup_nonexistent_user_returns_404(
    client: AsyncClient, internal_headers: dict
) -> None:
    response = await client.get(
        f"/api/v1/internal/users/{uuid.uuid4()}", headers=internal_headers
    )
    assert response.status_code == 404
