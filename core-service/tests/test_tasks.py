"""Integration tests for the task API.

Requires TEST_DATABASE_URL pointed at a disposable Postgres instance;
the core schema/tables are created and torn down by the db_session
fixture in conftest.py.
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

TASK_PAYLOAD = {
    "title": "Finish auth-service tests",
    "description": "Write integration tests for the refresh flow",
    "priority": "high",
    "tags": ["backend", "Backend", "  urgent "],
}


async def test_create_task(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.post(
        "/api/v1/tasks", json=TASK_PAYLOAD, headers=auth_headers
    )
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == TASK_PAYLOAD["title"]
    assert body["status"] == "pending"
    tag_names = sorted(t["name"] for t in body["tags"])
    assert tag_names == ["backend", "urgent"]  # deduped + normalized


async def test_create_task_requires_auth(client: AsyncClient) -> None:
    response = await client.post("/api/v1/tasks", json=TASK_PAYLOAD)
    assert response.status_code == 401


async def test_get_task_not_found(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.get(
        "/api/v1/tasks/00000000-0000-0000-0000-000000000000",
        headers=auth_headers,
    )
    assert response.status_code == 404


async def test_get_task_owned_by_another_user_is_forbidden(
    client: AsyncClient, auth_headers: dict
) -> None:
    import uuid
    from datetime import datetime, timedelta, timezone

    from jose import jwt

    from app.core.config import get_settings

    create_response = await client.post(
        "/api/v1/tasks", json=TASK_PAYLOAD, headers=auth_headers
    )
    task_id = create_response.json()["id"]

    # Build a validly-signed token for a *different* user id, so the
    # request passes authentication but should fail the ownership check.
    settings = get_settings()
    now = datetime.now(timezone.utc)
    other_user_payload = {
        "sub": str(uuid.uuid4()),
        "iat": now,
        "exp": now + timedelta(minutes=15),
        "type": "access",
        "jti": str(uuid.uuid4()),
    }
    other_token = jwt.encode(
        other_user_payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    other_user_headers = {"Authorization": f"Bearer {other_token}"}

    response = await client.get(
        f"/api/v1/tasks/{task_id}", headers=other_user_headers
    )
    assert response.status_code == 403


async def test_update_task_status_sets_completed_at(
    client: AsyncClient, auth_headers: dict
) -> None:
    create_response = await client.post(
        "/api/v1/tasks", json=TASK_PAYLOAD, headers=auth_headers
    )
    task_id = create_response.json()["id"]

    update_response = await client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"status": "completed"},
        headers=auth_headers,
    )
    assert update_response.status_code == 200
    body = update_response.json()
    assert body["status"] == "completed"
    assert body["completed_at"] is not None


async def test_list_tasks_filters_by_status(
    client: AsyncClient, auth_headers: dict
) -> None:
    await client.post("/api/v1/tasks", json=TASK_PAYLOAD, headers=auth_headers)
    second = {**TASK_PAYLOAD, "title": "Second task"}
    create_response = await client.post(
        "/api/v1/tasks", json=second, headers=auth_headers
    )
    task_id = create_response.json()["id"]
    await client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"status": "completed"},
        headers=auth_headers,
    )

    response = await client.get(
        "/api/v1/tasks", params={"status": "completed"}, headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["title"] == "Second task"


async def test_delete_task(client: AsyncClient, auth_headers: dict) -> None:
    create_response = await client.post(
        "/api/v1/tasks", json=TASK_PAYLOAD, headers=auth_headers
    )
    task_id = create_response.json()["id"]

    delete_response = await client.delete(
        f"/api/v1/tasks/{task_id}", headers=auth_headers
    )
    assert delete_response.status_code == 204

    get_response = await client.get(
        f"/api/v1/tasks/{task_id}", headers=auth_headers
    )
    assert get_response.status_code == 404
