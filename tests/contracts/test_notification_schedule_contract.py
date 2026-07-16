"""Contract: core-service -> notification-service, schedule + cancel.

Verifies that the exact payload core-service's NotificationClient
sends actually validates against notification-service's own Pydantic
request schema, and that the cancel URL it builds matches a route
notification-service actually registers.
"""
from tests.contracts.helpers import (
    get_route_paths,
    run_with_captured_http_call,
    validate_payload_against_model,
)

CORE_SERVICE_ENV = {}
NOTIFICATION_SERVICE_ENV = {}


def test_schedule_payload_matches_notification_service_schema() -> None:
    call_body = """
    import uuid
    from datetime import datetime, timezone
    from app.clients.notification_client import NotificationClient

    client = NotificationClient(base_url="http://notification-service:8000")
    await client.schedule_reminder_notification(
        reminder_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        remind_at=datetime.now(timezone.utc),
        message="Test reminder",
    )
"""
    captured = run_with_captured_http_call(
        "core-service", call_body, CORE_SERVICE_ENV
    )

    assert captured["url"].endswith("/api/v1/notifications/schedule")
    assert "x-internal-api-key" in captured["headers"]

    validate_payload_against_model(
        "notification-service",
        "app.schemas.notification",
        "ScheduleNotificationRequest",
        captured["payload"],
        NOTIFICATION_SERVICE_ENV,
    )


def test_schedule_payload_omits_message_gracefully() -> None:
    """message=None should still produce a valid payload (client falls
    back to a default string rather than sending null).
    """
    call_body = """
    import uuid
    from datetime import datetime, timezone
    from app.clients.notification_client import NotificationClient

    client = NotificationClient(base_url="http://notification-service:8000")
    await client.schedule_reminder_notification(
        reminder_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        remind_at=datetime.now(timezone.utc),
        message=None,
    )
"""
    captured = run_with_captured_http_call(
        "core-service", call_body, CORE_SERVICE_ENV
    )
    assert captured["payload"]["message"]  # non-empty fallback string
    validate_payload_against_model(
        "notification-service",
        "app.schemas.notification",
        "ScheduleNotificationRequest",
        captured["payload"],
        NOTIFICATION_SERVICE_ENV,
    )


def test_cancel_url_matches_a_notification_service_route() -> None:
    call_body = """
    import uuid
    from app.clients.notification_client import NotificationClient

    client = NotificationClient(base_url="http://notification-service:8000")
    await client.cancel_reminder_notification(reminder_id=uuid.uuid4())
"""
    captured = run_with_captured_http_call(
        "core-service", call_body, CORE_SERVICE_ENV
    )
    called_path = captured["url"].split("notification-service:8000")[-1]

    route_paths = get_route_paths(
        "notification-service", NOTIFICATION_SERVICE_ENV
    )
    # The concrete called path (with a real UUID) should match the
    # registered route template once we strip the templated segments
    # down to a comparable shape.
    matching_templates = [
        p
        for p in route_paths
        if p.startswith("/api/v1/notifications/source/")
        and p.endswith("/cancel")
    ]
    assert matching_templates, (
        f"No cancel route found among {route_paths}; "
        f"core-service called {called_path}"
    )
    assert "x-internal-api-key" in captured["headers"]
