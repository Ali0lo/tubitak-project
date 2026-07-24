"""Static routing table mapping gateway path prefixes to downstream services.

The gateway does not know about individual endpoints inside each
service; it only needs to know which service owns which top-level
path prefix and forwards everything below that prefix verbatim.
"""
from typing import Dict, Optional, Tuple

from app.config.settings import get_settings

settings = get_settings()

# Ordered so longer/more specific prefixes are matched before shorter
# ones (not strictly required here since prefixes don't overlap, but
# kept explicit for future-proofing).
ROUTE_TABLE: Dict[str, str] = {
    "/api/v1/auth": settings.AUTH_SERVICE_URL,
    "/api/v1/tasks": settings.CORE_SERVICE_URL,
    "/api/v1/meetings": settings.CORE_SERVICE_URL,
    "/api/v1/reminders": settings.CORE_SERVICE_URL,
    "/api/v1/ai": settings.AI_SERVICE_URL,
    "/api/v1/notifications": settings.NOTIFICATION_SERVICE_URL,
}

# Endpoints that must remain reachable without a bearer token, because
# they are how a client obtains one in the first place (or resets a
# forgotten credential). Every other proxied path requires an
# Authorization header to be present before the gateway will forward
# it — final verification of the token itself still happens in the
# owning service.
PUBLIC_PATH_PREFIXES: Tuple[str, ...] = (
    "/api/v1/auth/register",
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
    "/api/v1/auth/password-reset",
    "/api/v1/auth/verify-email",
    "/api/v1/auth/resend-verification",
)



def resolve_target(path: str) -> Optional[str]:
    """Return the base URL of the downstream service that owns `path`.

    Returns None if no configured prefix matches.
    """
    matches = [prefix for prefix in ROUTE_TABLE if path.startswith(prefix)]
    if not matches:
        return None
    # Prefer the longest matching prefix.
    best = max(matches, key=len)
    return ROUTE_TABLE[best]


def is_public_path(path: str) -> bool:
    """Return True if `path` may be proxied without an Authorization header."""
    return any(path.startswith(prefix) for prefix in PUBLIC_PATH_PREFIXES)
