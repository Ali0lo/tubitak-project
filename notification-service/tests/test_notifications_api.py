"""Integration tests for the notification API.

Requires TEST_DATABASE_URL (see conftest.py).
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


def _schedule_payload(**overrides) -> dict:
    payload = {
        "source": "core-service",
        "source_reference_id": str(uuid.uuid4()),
        "user_id": str(uuid.uuid4()),
        "scheduled_for": (
            datetime.now(timezone.utc) + timedelta(hours=1)
        ).isoformat(),
        "message": "Test reminder",
    }
    payload.update(overrides)
    return payload


async def test_schedule_requires_internal_api_key(app_client: AsyncClient) -> None:
    response = await app_client.post(
        "/api/v1/notifications/schedule", json=_schedule_payload()
    )
    assert response.status_code == 401


async def test_schedule_rejects_wrong_internal_api_key(
    app_client: AsyncClient,
) -> None:
    response = await app_client.post(
        "/api/v1/notifications/schedule",
        json=_schedule_payload(),
        headers={"X-Internal-Api-Key": "wrong-key"},
    )
    assert response.status_code == 401


async def test_schedule_succeeds_with_valid_internal_api_key(
    app_client: AsyncClient, internal_headers: dict
) -> None:
    response = await app_client.post(
        "/api/v1/notifications/schedule",
        json=_schedule_payload(),
        headers=internal_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert body["message"] == "Test reminder"


async def test_cancel_requires_internal_api_key(app_client: AsyncClient) -> None:
    response = await app_client.post(
        "/api/v1/notifications/source/core-service/some-id/cancel"
    )
    assert response.status_code == 401


async def test_cancel_with_valid_key_and_existing_notification(
    app_client: AsyncClient, internal_headers: dict
) -> None:
    reference_id = str(uuid.uuid4())
    await app_client.post(
        "/api/v1/notifications/schedule",
        json=_schedule_payload(source_reference_id=reference_id),
        headers=internal_headers,
    )

    response = await app_client.post(
        f"/api/v1/notifications/source/core-service/{reference_id}/cancel",
        headers=internal_headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


async def test_list_notifications_requires_user_auth(
    app_client: AsyncClient,
) -> None:
    response = await app_client.get("/api/v1/notifications")
    assert response.status_code == 401


async def test_list_notifications_returns_only_own(
    app_client: AsyncClient,
    internal_headers: dict,
    auth_headers: dict,
    test_user_id: uuid.UUID,
) -> None:
    await app_client.post(
        "/api/v1/notifications/schedule",
        json=_schedule_payload(user_id=str(test_user_id)),
        headers=internal_headers,
    )
    await app_client.post(
        "/api/v1/notifications/schedule",
        json=_schedule_payload(user_id=str(uuid.uuid4())),
        headers=internal_headers,
    )

    response = await app_client.get(
        "/api/v1/notifications", headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1


async def test_get_notification_not_found(
    app_client: AsyncClient, auth_headers: dict
) -> None:
    response = await app_client.get(
        f"/api/v1/notifications/{uuid.uuid4()}", headers=auth_headers
    )
    assert response.status_code == 404


async def test_preferences_default_to_email_enabled(
    app_client: AsyncClient, auth_headers: dict
) -> None:
    response = await app_client.get(
        "/api/v1/notifications/preferences", headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["email_enabled"] is True


async def test_update_preferences(
    app_client: AsyncClient, auth_headers: dict
) -> None:
    response = await app_client.patch(
        "/api/v1/notifications/preferences",
        json={"email_enabled": False},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["email_enabled"] is False

    follow_up = await app_client.get(
        "/api/v1/notifications/preferences", headers=auth_headers
    )
    assert follow_up.json()["email_enabled"] is False
