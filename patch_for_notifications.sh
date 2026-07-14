#!/usr/bin/env bash
# Todotak - required patch for auth-service and core-service
# notification-service needs these two changes to work:
#   1. auth-service gains an internal user-lookup endpoint,
#      used to resolve a user's email before sending a
#      notification email.
#   2. core-service's NotificationClient now sends the shared
#      internal API key header on its calls to notification-service.
#
# Run this from the root of your todotak/ repo, alongside
# setup_notification_service.sh:
#   bash patch_for_notifications.sh
set -euo pipefail

echo '==> Creating directories for new files'
mkdir -p "auth-service"
mkdir -p "auth-service/app"
mkdir -p "auth-service/app/api"
mkdir -p "auth-service/app/api/v1"
mkdir -p "auth-service/app/config"
mkdir -p "auth-service/tests"
mkdir -p "core-service"
mkdir -p "core-service/app/clients"
mkdir -p "core-service/app/core"
mkdir -p "core-service/tests"

echo '==> Writing auth-service/app/config/settings.py'
cat > "auth-service/app/config/settings.py" << 'TODOTAK_EOF'
"""Application configuration loaded from environment variables."""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the auth-service."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    SERVICE_NAME: str = "auth-service"

    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30

    # Shared across auth-service, core-service, and notification-service.
    # Guards internal, service-to-service-only endpoints such as the
    # user lookup notification-service uses to resolve an email address.
    INTERNAL_SERVICE_API_KEY: str

    CORS_ORIGINS: List[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
TODOTAK_EOF

echo '==> Writing auth-service/app/api/internal_deps.py'
cat > "auth-service/app/api/internal_deps.py" << 'TODOTAK_EOF'
"""Dependency guarding endpoints meant only for service-to-service calls."""
from typing import Optional

from fastapi import Header, HTTPException, status

from app.config.settings import get_settings

settings = get_settings()


async def verify_internal_api_key(
    x_internal_api_key: Optional[str] = Header(default=None),
) -> None:
    if not x_internal_api_key or x_internal_api_key != settings.INTERNAL_SERVICE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing internal API key",
        )
TODOTAK_EOF

echo '==> Writing auth-service/app/api/v1/internal.py'
cat > "auth-service/app/api/v1/internal.py" << 'TODOTAK_EOF'
"""Internal, service-to-service-only routes.

Not exposed through the gateway's normal user-facing routes in
practice — callers reach this directly on the internal network and
authenticate with the shared internal API key rather than a user's
access token.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.internal_deps import verify_internal_api_key
from app.db.session import get_db
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserResponse
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(
    prefix="/internal",
    tags=["internal"],
    dependencies=[Depends(verify_internal_api_key)],
)


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user_by_id(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    repository = UserRepository(db)
    user = await repository.get_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return UserResponse.model_validate(user)
TODOTAK_EOF

echo '==> Writing auth-service/app/main.py'
cat > "auth-service/app/main.py" << 'TODOTAK_EOF'
"""Auth-service FastAPI application entrypoint."""
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.auth import router as auth_router
from app.api.v1.internal import router as internal_router
from app.config.settings import get_settings
from app.middleware.exception_handler import register_exception_handlers

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application startup/shutdown hooks."""
    yield


def create_app() -> FastAPI:
    """Application factory for the auth-service."""
    app = FastAPI(
        title="Todotak Auth Service",
        description="Handles registration, login, token issuance, and password resets.",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(internal_router, prefix="/api/v1")

    @app.get("/health", tags=["health"])
    async def health_check() -> dict[str, str]:
        return {"status": "ok", "service": settings.SERVICE_NAME}

    return app


app = create_app()
TODOTAK_EOF

echo '==> Writing auth-service/.env.example'
cat > "auth-service/.env.example" << 'TODOTAK_EOF'
ENVIRONMENT=development
DEBUG=true
SERVICE_NAME=auth-service

DATABASE_URL=postgresql+asyncpg://todotak:todotak@postgres:5432/todotak
REDIS_URL=redis://redis:6379/0

JWT_SECRET_KEY=change-this-in-production-to-a-long-random-string
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES=30

# Shared across auth-service, core-service, and notification-service.
# Generate with: python3 -c "import secrets; print(secrets.token_urlsafe(48))"
INTERNAL_SERVICE_API_KEY=change-this-to-a-long-random-shared-secret

CORS_ORIGINS=["http://localhost:3000"]
TODOTAK_EOF

echo '==> Writing auth-service/tests/conftest.py'
cat > "auth-service/tests/conftest.py" << 'TODOTAK_EOF'
"""Shared pytest fixtures for auth-service tests."""
import asyncio
import os
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql+asyncpg://todotak:todotak@localhost:5432/todotak_test",
    ),
)
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-unit-tests-only")
os.environ.setdefault("INTERNAL_SERVICE_API_KEY", "test-internal-key")

from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models import PasswordResetToken, RefreshToken, User  # noqa: E402,F401


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(os.environ["DATABASE_URL"])
    async with engine.begin() as conn:
        await conn.execute(__import__("sqlalchemy").text(
            "CREATE SCHEMA IF NOT EXISTS auth"
        ))
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    app = create_app()

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
def internal_headers() -> dict:
    from app.config.settings import get_settings

    settings = get_settings()
    return {"X-Internal-Api-Key": settings.INTERNAL_SERVICE_API_KEY}
TODOTAK_EOF

echo '==> Writing auth-service/tests/test_internal.py'
cat > "auth-service/tests/test_internal.py" << 'TODOTAK_EOF'
"""Integration tests for the internal, service-to-service user-lookup route.

Requires TEST_DATABASE_URL (see conftest.py).
"""
import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

REGISTER_PAYLOAD = {
    "email": "lookup-target@example.com",
    "full_name": "Lookup Target",
    "password": "supersecret123",
}


async def test_lookup_requires_internal_api_key(client: AsyncClient) -> None:
    register_response = await client.post(
        "/api/v1/auth/register", json=REGISTER_PAYLOAD
    )
    user_id = register_response.json()["id"]

    response = await client.get(f"/api/v1/internal/users/{user_id}")
    assert response.status_code == 401


async def test_lookup_rejects_wrong_internal_api_key(client: AsyncClient) -> None:
    register_response = await client.post(
        "/api/v1/auth/register", json=REGISTER_PAYLOAD
    )
    user_id = register_response.json()["id"]

    response = await client.get(
        f"/api/v1/internal/users/{user_id}",
        headers={"X-Internal-Api-Key": "wrong-key"},
    )
    assert response.status_code == 401


async def test_lookup_returns_user_with_valid_key(
    client: AsyncClient, internal_headers: dict
) -> None:
    register_response = await client.post(
        "/api/v1/auth/register", json=REGISTER_PAYLOAD
    )
    user_id = register_response.json()["id"]

    response = await client.get(
        f"/api/v1/internal/users/{user_id}", headers=internal_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == REGISTER_PAYLOAD["email"]
    assert "hashed_password" not in body


async def test_lookup_nonexistent_user_returns_404(
    client: AsyncClient, internal_headers: dict
) -> None:
    response = await client.get(
        f"/api/v1/internal/users/{uuid.uuid4()}", headers=internal_headers
    )
    assert response.status_code == 404
TODOTAK_EOF

echo '==> Writing core-service/app/core/config.py'
cat > "core-service/app/core/config.py" << 'TODOTAK_EOF'
"""Application configuration loaded from environment variables."""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the core-service."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    SERVICE_NAME: str = "core-service"

    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"

    # Must match auth-service's JWT_SECRET_KEY / JWT_ALGORITHM so that
    # access tokens issued by auth-service can be verified here without
    # a network round-trip on every request.
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"

    NOTIFICATION_SERVICE_URL: str = "http://notification-service:8000"
    NOTIFICATION_SERVICE_TIMEOUT_SECONDS: float = 5.0

    # Shared across auth-service, core-service, and notification-service.
    # Sent as X-Internal-Api-Key when calling notification-service's
    # internal schedule/cancel endpoints directly (not through the gateway).
    INTERNAL_SERVICE_API_KEY: str

    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
TODOTAK_EOF

echo '==> Writing core-service/app/clients/notification_client.py'
cat > "core-service/app/clients/notification_client.py" << 'TODOTAK_EOF'
"""HTTP client for core-service -> notification-service communication.

This defines the internal API contract that notification-service's
`/api/v1/notifications/schedule` and `/api/v1/notifications/{id}/cancel`
endpoints implement. Failures here are logged and swallowed rather than
raised, so that a temporary notification-service outage never blocks a
task/meeting/reminder write in core-service.
"""
import logging
import uuid
from datetime import datetime
from typing import Optional

import httpx

from app.core.config import get_settings

logger = logging.getLogger("core-service.notification_client")
settings = get_settings()


class NotificationClient:
    """Thin async wrapper around notification-service's HTTP API."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> None:
        self.base_url = base_url or settings.NOTIFICATION_SERVICE_URL
        self.timeout = timeout or settings.NOTIFICATION_SERVICE_TIMEOUT_SECONDS

    async def schedule_reminder_notification(
        self,
        *,
        reminder_id: uuid.UUID,
        user_id: uuid.UUID,
        remind_at: datetime,
        message: Optional[str],
    ) -> bool:
        """Ask notification-service to deliver a notification at remind_at.

        Returns True if the request was accepted, False if it failed.
        A False return is non-fatal for the caller.
        """
        payload = {
            "source": "core-service",
            "source_reference_id": str(reminder_id),
            "user_id": str(user_id),
            "scheduled_for": remind_at.isoformat(),
            "message": message or "You have a reminder",
        }
        try:
            async with httpx.AsyncClient(
                base_url=self.base_url, timeout=self.timeout
            ) as client:
                response = await client.post(
                    "/api/v1/notifications/schedule",
                    json=payload,
                    headers={
                        "X-Internal-Api-Key": settings.INTERNAL_SERVICE_API_KEY
                    },
                )
                response.raise_for_status()
            return True
        except httpx.HTTPError as exc:
            logger.warning(
                "Failed to schedule notification for reminder %s: %s",
                reminder_id,
                exc,
            )
            return False

    async def cancel_reminder_notification(self, *, reminder_id: uuid.UUID) -> bool:
        """Ask notification-service to cancel a previously scheduled notification."""
        try:
            async with httpx.AsyncClient(
                base_url=self.base_url, timeout=self.timeout
            ) as client:
                response = await client.post(
                    f"/api/v1/notifications/source/core-service/{reminder_id}/cancel",
                    headers={
                        "X-Internal-Api-Key": settings.INTERNAL_SERVICE_API_KEY
                    },
                )
                response.raise_for_status()
            return True
        except httpx.HTTPError as exc:
            logger.warning(
                "Failed to cancel notification for reminder %s: %s",
                reminder_id,
                exc,
            )
            return False
TODOTAK_EOF

echo '==> Writing core-service/.env.example'
cat > "core-service/.env.example" << 'TODOTAK_EOF'
ENVIRONMENT=development
DEBUG=true
SERVICE_NAME=core-service

DATABASE_URL=postgresql+asyncpg://todotak:todotak@postgres:5432/todotak
REDIS_URL=redis://redis:6379/0

# Must match auth-service's values exactly so access tokens verify here.
JWT_SECRET_KEY=change-this-in-production-to-a-long-random-string
JWT_ALGORITHM=HS256

NOTIFICATION_SERVICE_URL=http://notification-service:8000
NOTIFICATION_SERVICE_TIMEOUT_SECONDS=5.0

# Shared across auth-service, core-service, and notification-service.
# Generate with: python3 -c "import secrets; print(secrets.token_urlsafe(48))"
INTERNAL_SERVICE_API_KEY=change-this-to-a-long-random-shared-secret

CORS_ORIGINS=["http://localhost:3000"]

DEFAULT_PAGE_SIZE=20
MAX_PAGE_SIZE=100
TODOTAK_EOF

echo '==> Writing core-service/tests/conftest.py'
cat > "core-service/tests/conftest.py" << 'TODOTAK_EOF'
"""Shared pytest fixtures for core-service tests."""
import asyncio
import os
import uuid
from datetime import timedelta
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql+asyncpg://todotak:todotak@localhost:5432/todotak_test",
    ),
)
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-unit-tests-only")
os.environ.setdefault("INTERNAL_SERVICE_API_KEY", "test-internal-key")

from app.core.config import get_settings  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models import (  # noqa: E402,F401
    Meeting,
    MeetingParticipant,
    Reminder,
    Task,
    TaskTag,
)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(os.environ["DATABASE_URL"])
    async with engine.begin() as conn:
        await conn.execute(
            __import__("sqlalchemy").text("CREATE SCHEMA IF NOT EXISTS core")
        )
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    app = create_app()

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
def test_user_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def auth_headers(test_user_id: uuid.UUID) -> dict:
    """Build an Authorization header with a JWT access token.

    Mirrors auth-service's token shape (sub, type=access, exp) so that
    core-service's decode logic accepts it exactly as it would in
    production.
    """
    from datetime import datetime, timezone

    from jose import jwt

    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(test_user_id),
        "iat": now,
        "exp": now + timedelta(minutes=15),
        "type": "access",
        "jti": str(uuid.uuid4()),
    }
    token = jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )
    return {"Authorization": f"Bearer {token}"}
TODOTAK_EOF

echo '==> auth-service and core-service patched successfully'
echo 'Remember: INTERNAL_SERVICE_API_KEY must be the SAME value in'
echo 'auth-service/.env, core-service/.env, and notification-service/.env'