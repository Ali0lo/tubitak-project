"""Integration tests for the meeting API."""
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


def _meeting_payload() -> dict:
    start = datetime.now(timezone.utc) + timedelta(days=1)
    end = start + timedelta(hours=1)
    return {
        "title": "Sprint planning",
        "description": "Plan next sprint",
        "location": "Zoom",
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "participants": [
            {"email": "teammate@example.com", "name": "Teammate"}
        ],
    }


async def test_create_meeting(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.post(
        "/api/v1/meetings", json=_meeting_payload(), headers=auth_headers
    )
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Sprint planning"
    assert body["status"] == "scheduled"
    assert len(body["participants"]) == 1
    assert body["participants"][0]["response_status"] == "pending"


async def test_create_meeting_rejects_invalid_time_range(
    client: AsyncClient, auth_headers: dict
) -> None:
    payload = _meeting_payload()
    payload["end_time"] = payload["start_time"]
    response = await client.post(
        "/api/v1/meetings", json=payload, headers=auth_headers
    )
    assert response.status_code == 422


async def test_cancel_meeting(client: AsyncClient, auth_headers: dict) -> None:
    create_response = await client.post(
        "/api/v1/meetings", json=_meeting_payload(), headers=auth_headers
    )
    meeting_id = create_response.json()["id"]

    cancel_response = await client.post(
        f"/api/v1/meetings/{meeting_id}/cancel", headers=auth_headers
    )
    assert cancel_response.status_code == 200
    assert cancel_response.json()["status"] == "cancelled"


async def test_update_participant_response(
    client: AsyncClient, auth_headers: dict
) -> None:
    create_response = await client.post(
        "/api/v1/meetings", json=_meeting_payload(), headers=auth_headers
    )
    body = create_response.json()
    meeting_id = body["id"]
    participant_id = body["participants"][0]["id"]

    response = await client.patch(
        f"/api/v1/meetings/{meeting_id}/participants/{participant_id}",
        json={"response_status": "accepted"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    updated_participant = next(
        p for p in response.json()["participants"] if p["id"] == participant_id
    )
    assert updated_participant["response_status"] == "accepted"


async def test_list_meetings_filters_by_status(
    client: AsyncClient, auth_headers: dict
) -> None:
    create_response = await client.post(
        "/api/v1/meetings", json=_meeting_payload(), headers=auth_headers
    )
    meeting_id = create_response.json()["id"]
    await client.post(
        f"/api/v1/meetings/{meeting_id}/cancel", headers=auth_headers
    )

    response = await client.get(
        "/api/v1/meetings", params={"status": "cancelled"}, headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == meeting_id
