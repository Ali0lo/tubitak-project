"""Password hashing and JWT encoding/decoding utilities."""
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Tuple

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHash, VerificationError, VerifyMismatchError
from jose import JWTError, jwt

from app.config.settings import get_settings

settings = get_settings()
_hasher = PasswordHasher()


class TokenError(Exception):
    """Raised when a JWT cannot be decoded or verified."""


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return _hasher.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against an Argon2 hash."""
    try:
        return _hasher.verify(hashed_password, password)
    except (VerifyMismatchError, VerificationError, InvalidHash):
        return False


def create_access_token(
    subject: str, extra_claims: Optional[dict[str, Any]] = None
) -> str:
    """Create a short-lived JWT access token for the given user id."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": expire,
        "type": "access",
        "jti": str(uuid.uuid4()),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def create_refresh_token(subject: str) -> Tuple[str, str, datetime]:
    """Create a long-lived JWT refresh token.

    Returns a tuple of (token, jti, expires_at) so the caller can persist
    a hash of the token alongside its identifier for rotation/revocation.
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    jti = str(uuid.uuid4())
    payload = {
        "sub": subject,
        "iat": now,
        "exp": expire,
        "type": "refresh",
        "jti": jti,
    }
    token = jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )
    return token, jti, expire


def decode_token(token: str) -> dict[str, Any]:
    """Decode and verify a JWT, raising TokenError on failure."""
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError as exc:
        raise TokenError(str(exc)) from exc


def hash_token(token: str) -> str:
    """Return a SHA-256 hex digest of a token for safe storage/lookup."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
