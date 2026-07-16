"""Contract: ai-service -> core-service, tool-backed HTTP calls.

Verifies that every payload ai-service's CoreServiceClient builds
(used by the agent's tools — create_task, create_meeting,
create_reminder) actually validates against core-service's own
Pydantic request schemas, and that the URLs/methods used match a real
core-service route.
"""
from tests.contracts.helpers import (
    get_route_paths,
    run_with_captured_http_call,
    validate_payload_against_model,
)


def test_create_task_payload_matches_core_service_schema() -> None:
    call_body = """
    from app.clients.core_service_client import CoreServiceClient

    client = CoreServiceClient(base_url="http://core-service:8000")
    await client.create_task(
        "fake-token",
        title="Buy milk",
        description="From the AI agent",
        priority="high",
        tags=["errand"],
    )
"""
    captured = run_with_captured_http_call("ai-service", call_body)
    assert captured["url"].endswith("/api/v1/tasks")
    assert captured["headers"].get("authorization") == "Bearer fake-token"

    validate_payload_against_model(
        "core-service", "app.schemas.task", "TaskCreate", captured["payload"]
    )


def test_create_meeting_payload_matches_core_service_schema() -> None:
    call_body = """
    from app.clients.core_service_client import CoreServiceClient

    client = CoreServiceClient(base_url="http://core-service:8000")
    await client.create_meeting(
        "fake-token",
        title="Sync",
        start_time="2026-08-01T10:00:00Z",
        end_time="2026-08-01T11:00:00Z",
        participants=[{"email": "a@example.com", "name": "A"}],
    )
"""
    captured = run_with_captured_http_call("ai-service", call_body)
    assert captured["url"].endswith("/api/v1/meetings")

    validate_payload_against_model(
        "core-service",
        "app.schemas.meeting",
        "MeetingCreate",
        captured["payload"],
    )


def test_create_reminder_payload_matches_core_service_schema() -> None:
    call_body = """
    from app.clients.core_service_client import CoreServiceClient

    client = CoreServiceClient(base_url="http://core-service:8000")
    await client.create_reminder(
        "fake-token",
        remind_at="2026-08-01T09:00:00Z",
        message="Don't forget",
    )
"""
    captured = run_with_captured_http_call("ai-service", call_body)
    assert captured["url"].endswith("/api/v1/reminders")

    validate_payload_against_model(
        "core-service",
        "app.schemas.reminder",
        "ReminderCreate",
        captured["payload"],
    )


def test_update_task_payload_matches_core_service_schema() -> None:
    call_body = """
    from app.clients.core_service_client import CoreServiceClient

    client = CoreServiceClient(base_url="http://core-service:8000")
    await client.update_task(
        "fake-token",
        "00000000-0000-0000-0000-000000000000",
        status="completed",
    )
"""
    captured = run_with_captured_http_call("ai-service", call_body)
    assert "/api/v1/tasks/" in captured["url"]

    validate_payload_against_model(
        "core-service", "app.schemas.task", "TaskUpdate", captured["payload"]
    )


def test_every_core_service_client_endpoint_exists_on_core_service() -> None:
    """Cheap structural check: every path prefix CoreServiceClient talks
    to should correspond to a real route core-service registers.
    """
    route_paths = get_route_paths("core-service")
    prefixes_used = ["/api/v1/tasks", "/api/v1/meetings", "/api/v1/reminders"]
    for prefix in prefixes_used:
        assert any(p.startswith(prefix) for p in route_paths), (
            f"{prefix} not found among core-service routes: {route_paths}"
        )
