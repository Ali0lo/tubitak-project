"""Contract: notification-service -> auth-service, internal user lookup.

Verifies that AuthServiceClient calls the exact path auth-service
registers, sends the internal API key header, and that auth-service's
UserResponse schema actually contains the "email" field
AuthServiceClient.get_user_email() reads out of the response.
"""
from tests.contracts.helpers import (
    get_json_schema,
    get_route_paths,
    run_with_captured_http_call,
)


def test_auth_service_registers_the_internal_lookup_route() -> None:
    route_paths = get_route_paths("auth-service")
    assert "/api/v1/internal/users/{user_id}" in route_paths


def test_user_response_schema_includes_email_field() -> None:
    schema = get_json_schema(
        "auth-service", "app.schemas.user", "UserResponse"
    )
    assert "email" in schema["properties"]
    assert "email" in schema.get("required", [])


def test_notification_service_calls_the_matching_path_and_header() -> None:
    call_body = """
    import uuid
    from app.clients.auth_service_client import AuthServiceClient

    client = AuthServiceClient(base_url="http://auth-service:8000")
    await client.get_user_email(uuid.uuid4())
"""
    captured = run_with_captured_http_call("notification-service", call_body)

    route_paths = get_route_paths("auth-service")
    assert "/api/v1/internal/users/{user_id}" in route_paths
    assert "/api/v1/internal/users/" in captured["url"]
    assert captured["headers"].get("x-internal-api-key")
