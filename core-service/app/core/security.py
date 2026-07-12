"""JWT verification for access tokens issued by auth-service.

core-service does not issue tokens itself; it only verifies access
tokens using the shared JWT_SECRET_KEY, avoiding a network call to
auth-service on every request.
"""
import uuid
from typing import Any

from jose import JWTError, jwt

from app.core.config import get_settings
from app.core.exceptions import InvalidTokenError

settings = get_settings()


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and verify a JWT access token, raising InvalidTokenError on failure."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError as exc:
        raise InvalidTokenError() from exc

    if payload.get("type") != "access":
        raise InvalidTokenError()
    return payload


def get_user_id_from_token(token: str) -> uuid.UUID:
    """Extract and parse the user id (`sub` claim) from an access token."""
    payload = decode_access_token(token)
    subject = payload.get("sub")
    if not subject:
        raise InvalidTokenError()
    try:
        return uuid.UUID(subject)
    except (ValueError, TypeError) as exc:
        raise InvalidTokenError() from exc
