"""Contract: gateway's static route table against real backend routes.

Verifies every prefix in gateway's ROUTE_TABLE actually corresponds
to at least one route the target service registers — catching the
class of bug where a service renames or removes an endpoint and the
gateway silently keeps routing to a prefix that now 404s everywhere.
"""
from tests.contracts.helpers import run_script, get_route_paths


def _get_gateway_route_table() -> dict:
    script = """
import json
from app.config.routes_table import ROUTE_TABLE
print(json.dumps(ROUTE_TABLE))
"""
    output = run_script("gateway", script)
    import json

    return json.loads(output.splitlines()[-1])


# Maps a gateway route-table prefix to the service whose routes it
# should be checked against, and the env that service needs to import.
SERVICE_FOR_PREFIX = {
    "/api/v1/auth": "auth-service",
    "/api/v1/tasks": "core-service",
    "/api/v1/meetings": "core-service",
    "/api/v1/reminders": "core-service",
    "/api/v1/ai": "ai-service",
    "/api/v1/notifications": "notification-service",
}


def test_route_table_prefixes_have_a_real_backend_service() -> None:
    route_table = _get_gateway_route_table()
    for prefix in route_table:
        assert prefix in SERVICE_FOR_PREFIX, (
            f"{prefix} is in gateway's ROUTE_TABLE but this test doesn't "
            "know which service it should map to — update SERVICE_FOR_PREFIX"
        )


def test_every_route_table_prefix_matches_a_real_route() -> None:
    route_table = _get_gateway_route_table()
    for prefix, service in SERVICE_FOR_PREFIX.items():
        if prefix not in route_table:
            continue
        route_paths = get_route_paths(service)
        assert any(p.startswith(prefix) for p in route_paths), (
            f"gateway routes {prefix} -> {service}, but {service} has no "
            f"route starting with {prefix}. Its routes: {route_paths}"
        )
