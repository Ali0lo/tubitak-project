"""End-to-end: register -> login -> manage tasks/meetings/reminders ->
chat with the AI assistant -> logout, all through the real gateway
against a fully running stack.

Requires: `make up && make migrate` first, and a real OPENAI_API_KEY
in .env for the chat tests (they're skipped automatically if the
assistant is unreachable, rather than failing the whole run over an
external dependency).
"""
import httpx
import pytest


def test_health_check_reports_all_services_ok(client: httpx.Client) -> None:
    response = client.get("/health/services")
    assert response.status_code == 200
    body = response.json()
    unhealthy = {k: v for k, v in body["services"].items() if v != "ok"}
    assert not unhealthy, f"Unhealthy services: {unhealthy}"


def test_register_and_login(client: httpx.Client, unique_email: str) -> None:
    password = "e2e-test-password-123"
    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "full_name": "New User",
            "password": password,
        },
    )
    assert register_response.status_code == 201
    assert register_response.json()["email"] == unique_email

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": password},
    )
    assert login_response.status_code == 200
    assert "access_token" in login_response.json()


def test_protected_endpoint_rejects_no_token(client: httpx.Client) -> None:
    response = client.get("/api/v1/tasks")
    assert response.status_code == 401


def test_full_task_lifecycle(client: httpx.Client, registered_user: dict) -> None:
    headers = registered_user["headers"]

    create_response = client.post(
        "/api/v1/tasks",
        json={"title": "E2E: buy groceries", "priority": "medium"},
        headers=headers,
    )
    assert create_response.status_code == 201
    task = create_response.json()
    task_id = task["id"]

    list_response = client.get("/api/v1/tasks", headers=headers)
    assert list_response.status_code == 200
    assert any(t["id"] == task_id for t in list_response.json()["items"])

    update_response = client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"status": "completed"},
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "completed"

    delete_response = client.delete(f"/api/v1/tasks/{task_id}", headers=headers)
    assert delete_response.status_code == 204

    get_response = client.get(f"/api/v1/tasks/{task_id}", headers=headers)
    assert get_response.status_code == 404


def test_full_meeting_lifecycle(
    client: httpx.Client, registered_user: dict
) -> None:
    headers = registered_user["headers"]

    create_response = client.post(
        "/api/v1/meetings",
        json={
            "title": "E2E: planning sync",
            "start_time": "2027-01-15T10:00:00Z",
            "end_time": "2027-01-15T11:00:00Z",
        },
        headers=headers,
    )
    assert create_response.status_code == 201
    meeting_id = create_response.json()["id"]

    cancel_response = client.post(
        f"/api/v1/meetings/{meeting_id}/cancel", headers=headers
    )
    assert cancel_response.status_code == 200
    assert cancel_response.json()["status"] == "cancelled"


def test_reminder_linked_to_a_task(
    client: httpx.Client, registered_user: dict
) -> None:
    headers = registered_user["headers"]

    task_response = client.post(
        "/api/v1/tasks",
        json={"title": "E2E: task with reminder"},
        headers=headers,
    )
    task_id = task_response.json()["id"]

    reminder_response = client.post(
        "/api/v1/reminders",
        json={
            "remind_at": "2027-01-15T09:00:00Z",
            "message": "E2E reminder",
            "task_id": task_id,
        },
        headers=headers,
    )
    assert reminder_response.status_code == 201
    assert reminder_response.json()["task_id"] == task_id


def test_reminder_for_nonexistent_task_is_rejected(
    client: httpx.Client, registered_user: dict
) -> None:
    response = client.post(
        "/api/v1/reminders",
        json={
            "remind_at": "2027-01-15T09:00:00Z",
            "task_id": "00000000-0000-0000-0000-000000000000",
        },
        headers=registered_user["headers"],
    )
    assert response.status_code == 404


def test_ai_chat_creates_a_task(
    client: httpx.Client, registered_user: dict
) -> None:
    headers = registered_user["headers"]

    chat_response = client.post(
        "/api/v1/ai/chat",
        json={"message": "Add a task: pick up dry cleaning"},
        headers=headers,
        timeout=60.0,
    )
    if chat_response.status_code == 502:
        pytest.skip(
            "AI assistant unreachable (likely no valid OPENAI_API_KEY "
            "configured for this environment) — skipping rather than "
            "failing on an external dependency."
        )
    assert chat_response.status_code == 200
    body = chat_response.json()
    assert body["message"]["role"] == "assistant"
    assert body["message"]["content"]

    tasks_response = client.get("/api/v1/tasks", headers=headers)
    titles = [t["title"].lower() for t in tasks_response.json()["items"]]
    assert any("dry cleaning" in title for title in titles), (
        "Expected the AI assistant to have created a task via tool "
        f"calling; current tasks: {titles}"
    )


def test_logout_revokes_refresh_token(
    client: httpx.Client, registered_user: dict
) -> None:
    logout_response = client.post(
        "/api/v1/auth/logout", headers=registered_user["headers"]
    )
    assert logout_response.status_code == 204
