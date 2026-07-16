"""Every protected endpoint, across every service, must reject a
request with no Authorization header. This sweeps the real endpoint
list from docs/api.md against each service's real ASGI app — no
database or network required (see helpers.py for how).
"""
from tests.security.helpers import DUMMY_UUID, sweep_unauthenticated_requests


def test_core_service_protected_endpoints_reject_unauthenticated() -> None:
    requests = [
        ("POST", "/api/v1/tasks"),
        ("GET", "/api/v1/tasks"),
        ("GET", f"/api/v1/tasks/{DUMMY_UUID}"),
        ("PATCH", f"/api/v1/tasks/{DUMMY_UUID}"),
        ("PUT", f"/api/v1/tasks/{DUMMY_UUID}/tags"),
        ("DELETE", f"/api/v1/tasks/{DUMMY_UUID}"),
        ("POST", "/api/v1/meetings"),
        ("GET", "/api/v1/meetings"),
        ("GET", f"/api/v1/meetings/{DUMMY_UUID}"),
        ("PATCH", f"/api/v1/meetings/{DUMMY_UUID}"),
        ("POST", f"/api/v1/meetings/{DUMMY_UUID}/cancel"),
        ("DELETE", f"/api/v1/meetings/{DUMMY_UUID}"),
        ("POST", "/api/v1/reminders"),
        ("GET", "/api/v1/reminders"),
        ("GET", f"/api/v1/reminders/{DUMMY_UUID}"),
        ("PATCH", f"/api/v1/reminders/{DUMMY_UUID}"),
        ("DELETE", f"/api/v1/reminders/{DUMMY_UUID}"),
    ]
    results = sweep_unauthenticated_requests(
        "core-service", "app.db.session", "get_db", requests
    )
    failures = [r for r in results if r["status"] != 401]
    assert not failures, f"Expected 401 for all, got: {failures}"


def test_ai_service_protected_endpoints_reject_unauthenticated() -> None:
    requests = [
        ("POST", "/api/v1/ai/chat"),
        ("GET", "/api/v1/ai/conversations"),
        ("GET", f"/api/v1/ai/conversations/{DUMMY_UUID}"),
        ("PATCH", f"/api/v1/ai/conversations/{DUMMY_UUID}"),
        ("DELETE", f"/api/v1/ai/conversations/{DUMMY_UUID}"),
    ]
    results = sweep_unauthenticated_requests(
        "ai-service", "app.db.session", "get_db", requests
    )
    failures = [r for r in results if r["status"] != 401]
    assert not failures, f"Expected 401 for all, got: {failures}"


def test_notification_service_user_endpoints_reject_unauthenticated() -> None:
    requests = [
        ("GET", "/api/v1/notifications"),
        ("GET", f"/api/v1/notifications/{DUMMY_UUID}"),
        ("GET", "/api/v1/notifications/preferences"),
        ("PATCH", "/api/v1/notifications/preferences"),
    ]
    results = sweep_unauthenticated_requests(
        "notification-service", "app.db.session", "get_db", requests
    )
    failures = [r for r in results if r["status"] != 401]
    assert not failures, f"Expected 401 for all, got: {failures}"


def test_notification_service_internal_endpoints_reject_missing_internal_key() -> None:
    """These don't use user auth at all — a missing/wrong
    X-Internal-Api-Key should still be a 401, just via a different
    dependency (verify_internal_api_key, not get_current_user_id).
    """
    requests = [
        ("POST", "/api/v1/notifications/schedule"),
        ("POST", f"/api/v1/notifications/source/core-service/{DUMMY_UUID}/cancel"),
    ]
    results = sweep_unauthenticated_requests(
        "notification-service", "app.db.session", "get_db", requests
    )
    failures = [r for r in results if r["status"] != 401]
    assert not failures, f"Expected 401 for all, got: {failures}"


def test_auth_service_protected_endpoints_reject_unauthenticated() -> None:
    """Only /me is genuinely user-auth-protected in auth-service — the
    rest of /api/v1/auth/* is intentionally public (that's how you get
    a token in the first place). /internal/* is checked separately
    since it uses a different auth mechanism.
    """
    requests = [("GET", "/api/v1/auth/me")]
    results = sweep_unauthenticated_requests(
        "auth-service", "app.db.session", "get_db", requests
    )
    failures = [r for r in results if r["status"] != 401]
    assert not failures, f"Expected 401 for all, got: {failures}"


def test_auth_service_internal_endpoint_rejects_missing_internal_key() -> None:
    requests = [("GET", f"/api/v1/internal/users/{DUMMY_UUID}")]
    results = sweep_unauthenticated_requests(
        "auth-service", "app.db.session", "get_db", requests
    )
    failures = [r for r in results if r["status"] != 401]
    assert not failures, f"Expected 401 for all, got: {failures}"


def test_auth_service_public_endpoints_do_not_require_auth() -> None:
    """Sanity check in the opposite direction: these must NOT 401 just
    because there's no Authorization header (they may still fail
    validation for other reasons, e.g. a missing DB — anything other
    than 401 proves they didn't reject purely for lack of auth).
    """
    requests = [
        ("POST", "/api/v1/auth/register"),
        ("POST", "/api/v1/auth/login"),
        ("POST", "/api/v1/auth/refresh"),
        ("POST", "/api/v1/auth/password-reset/request"),
    ]
    results = sweep_unauthenticated_requests(
        "auth-service", "app.db.session", "get_db", requests
    )
    wrongly_rejected = [r for r in results if r["status"] == 401]
    assert not wrongly_rejected, (
        f"These are meant to be public but got 401: {wrongly_rejected}"
    )
