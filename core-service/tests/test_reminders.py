"""Integration tests for the reminder API.

The NotificationClient calls out to notification-service over HTTP;
in this test environment that service isn't running, so those calls
fail fast and are swallowed by NotificationClient (see
app/clients/notification_client.py), which does not affect these
assertions.
"""
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


def _reminder_payload(**overrides) -> dict:
    payload = {
        "remind_at": (
            datetime.now(timezone.utc) + timedelta(hours=2)
        ).isoformat(),
        "message": "Don't forget the standup",
    }
    payload.update(overrides)
    return payload


async def test_create_standalone_reminder(
    client: AsyncClient, auth_headers: dict
) -> None:
    response = await client.post(
        "/api/v1/reminders", json=_reminder_payload(), headers=auth_headers
    )
    assert response.status_code == 201
    body = response.json()
    assert body["message"] == "Don't forget the standup"
    assert body["is_sent"] is False
    assert body["task_id"] is None
    assert body["meeting_id"] is None


async def test_create_reminder_rejects_both_task_and_meeting(
    client: AsyncClient, auth_headers: dict
) -> None:
    import uuid

    payload = _reminder_payload(
        task_id=str(uuid.uuid4()), meeting_id=str(uuid.uuid4())
    )
    response = await client.post(
        "/api/v1/reminders", json=payload, headers=auth_headers
    )
    assert response.status_code == 422


async def test_create_reminder_for_owned_task(
    client: AsyncClient, auth_headers: dict
) -> None:
    task_response = await client.post(
        "/api/v1/tasks",
        json={"title": "Buy groceries", "priority": "low"},
        headers=auth_headers,
    )
    task_id = task_response.json()["id"]

    response = await client.post(
        "/api/v1/reminders",
        json=_reminder_payload(task_id=task_id),
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["task_id"] == task_id


async def test_create_reminder_for_nonexistent_task_fails(
    client: AsyncClient, auth_headers: dict
) -> None:
    import uuid

    response = await client.post(
        "/api/v1/reminders",
        json=_reminder_payload(task_id=str(uuid.uuid4())),
        headers=auth_headers,
    )
    assert response.status_code == 404


async def test_update_reminder(client: AsyncClient, auth_headers: dict) -> None:
    create_response = await client.post(
        "/api/v1/reminders", json=_reminder_payload(), headers=auth_headers
    )
    reminder_id = create_response.json()["id"]

    new_time = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    response = await client.patch(
        f"/api/v1/reminders/{reminder_id}",
        json={"remind_at": new_time, "message": "Updated message"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Updated message"


async def test_delete_reminder(client: AsyncClient, auth_headers: dict) -> None:
    create_response = await client.post(
        "/api/v1/reminders", json=_reminder_payload(), headers=auth_headers
    )
    reminder_id = create_response.json()["id"]

    delete_response = await client.delete(
        f"/api/v1/reminders/{reminder_id}", headers=auth_headers
    )
    assert delete_response.status_code == 204

    get_response = await client.get(
        f"/api/v1/reminders/{reminder_id}", headers=auth_headers
    )
    assert get_response.status_code == 404


async def test_list_reminders_filters_by_sent_status(
    client: AsyncClient, auth_headers: dict
) -> None:
    await client.post(
        "/api/v1/reminders", json=_reminder_payload(), headers=auth_headers
    )
    response = await client.get(
        "/api/v1/reminders", params={"is_sent": False}, headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["total"] == 1
