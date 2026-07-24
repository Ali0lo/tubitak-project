"""Integration tests for the auth-service HTTP API.

These tests require a reachable PostgreSQL instance; set
TEST_DATABASE_URL to point at a disposable test database before
running `pytest`. The auth schema and tables are created and torn
down automatically by the db_session fixture in conftest.py.
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

REGISTER_PAYLOAD = {
    "email": "ali@example.com",
    "full_name": "Ali Iskandarli",
    "password": "supersecret123",
}


async def _register(client: AsyncClient, **overrides) -> dict:
    payload = {**REGISTER_PAYLOAD, **overrides}
    response = await client.post("/api/v1/auth/register", json=payload)
    return response


async def test_register_creates_user(client: AsyncClient) -> None:
    response = await _register(client)
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == REGISTER_PAYLOAD["email"]
    assert body["is_active"] is True
    assert "password" not in body
    assert "hashed_password" not in body


async def test_register_duplicate_email_rejected(client: AsyncClient) -> None:
    await _register(client)
    response = await _register(client)
    assert response.status_code == 409


async def test_login_success_returns_tokens(client: AsyncClient) -> None:
    await _register(client)
    response = await client.post(
        "/api/v1/auth/login",
        json={
            "email": REGISTER_PAYLOAD["email"],
            "password": REGISTER_PAYLOAD["password"],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["refresh_token"]
    assert response.cookies.get("refresh_token") is not None


async def test_login_wrong_password_rejected(client: AsyncClient) -> None:
    await _register(client)
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": REGISTER_PAYLOAD["email"], "password": "wrong-password"},
    )
    assert response.status_code == 401


async def test_me_requires_authentication(client: AsyncClient) -> None:
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


async def test_me_returns_current_user(client: AsyncClient) -> None:
    await _register(client)
    login_response = await client.post(
        "/api/v1/auth/login",
        json={
            "email": REGISTER_PAYLOAD["email"],
            "password": REGISTER_PAYLOAD["password"],
        },
    )
    access_token = login_response.json()["access_token"]

    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == REGISTER_PAYLOAD["email"]


async def test_refresh_rotates_tokens(client: AsyncClient) -> None:
    await _register(client)
    login_response = await client.post(
        "/api/v1/auth/login",
        json={
            "email": REGISTER_PAYLOAD["email"],
            "password": REGISTER_PAYLOAD["password"],
        },
    )
    old_refresh_token = login_response.json()["refresh_token"]

    refresh_response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh_token},
    )
    assert refresh_response.status_code == 200
    new_tokens = refresh_response.json()
    assert new_tokens["refresh_token"] != old_refresh_token

    reuse_response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh_token},
    )
    assert reuse_response.status_code == 401


async def test_logout_revokes_refresh_token(client: AsyncClient) -> None:
    await _register(client)
    login_response = await client.post(
        "/api/v1/auth/login",
        json={
            "email": REGISTER_PAYLOAD["email"],
            "password": REGISTER_PAYLOAD["password"],
        },
    )
    refresh_token = login_response.json()["refresh_token"]

    logout_response = await client.post(
        "/api/v1/auth/logout", json={"refresh_token": refresh_token}
    )
    assert logout_response.status_code == 204

    refresh_response = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refresh_token}
    )
    assert refresh_response.status_code == 401


async def test_password_reset_flow(client: AsyncClient) -> None:
    await _register(client)

    request_response = await client.post(
        "/api/v1/auth/password-reset/request",
        json={"email": REGISTER_PAYLOAD["email"]},
    )
    assert request_response.status_code == 202

    # The raw reset token is only ever available via the notification
    # pipeline in production; this test exercises the confirm endpoint's
    # validation behavior with a token that is not on file.
    confirm_response = await client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": "not-a-real-token", "new_password": "brandnewpass123"},
    )
    assert confirm_response.status_code == 401


async def test_password_reset_request_unknown_email_is_silent(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/v1/auth/password-reset/request",
        json={"email": "unknown@example.com"},
    )
    assert response.status_code == 202


async def test_verify_email_invalid_token_returns_400(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/verify-email",
        json={"token": "invalid-token-xyz"},
    )
    assert response.status_code == 400
    assert "Invalid or expired" in response.json()["detail"]

