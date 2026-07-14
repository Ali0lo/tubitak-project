#!/usr/bin/env bash
# Todotak - notification-service full implementation
# Run this from the root of your todotak/ repo:
#   bash setup_notification_service.sh
set -euo pipefail

echo '==> Creating notification-service directories'
mkdir -p "notification-service"
mkdir -p "notification-service/alembic"
mkdir -p "notification-service/alembic/versions"
mkdir -p "notification-service/app"
mkdir -p "notification-service/app/api"
mkdir -p "notification-service/app/api/v1"
mkdir -p "notification-service/app/clients"
mkdir -p "notification-service/app/core"
mkdir -p "notification-service/app/db"
mkdir -p "notification-service/app/models"
mkdir -p "notification-service/app/queue"
mkdir -p "notification-service/app/repositories"
mkdir -p "notification-service/app/schemas"
mkdir -p "notification-service/app/services"
mkdir -p "notification-service/app/templates"
mkdir -p "notification-service/app/workers"
mkdir -p "notification-service/tests"

echo '==> Writing notification-service/.env.example'
cat > "notification-service/.env.example" << 'TODOTAK_EOF'
ENVIRONMENT=development
DEBUG=true
SERVICE_NAME=notification-service

DATABASE_URL=postgresql+asyncpg://todotak:todotak@postgres:5432/todotak
REDIS_URL=redis://redis:6379/3

# Must match auth-service's values exactly so end-user access tokens verify here.
JWT_SECRET_KEY=change-this-in-production-to-a-long-random-string
JWT_ALGORITHM=HS256

# Shared across auth-service, core-service, and notification-service.
# Generate with: python3 -c "import secrets; print(secrets.token_urlsafe(48))"
INTERNAL_SERVICE_API_KEY=change-this-to-a-long-random-shared-secret

SMTP_HOST=localhost
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_USE_TLS=true
SMTP_FROM_EMAIL=no-reply@todotak.app
SMTP_FROM_NAME=Todotak
SMTP_TIMEOUT_SECONDS=10.0

NOTIFICATION_QUEUE_KEY=notifications:dispatch_queue
SCHEDULER_POLL_INTERVAL_SECONDS=15.0
SCHEDULER_BATCH_SIZE=100
DISPATCH_QUEUE_TIMEOUT_SECONDS=5.0

AUTH_SERVICE_URL=http://auth-service:8000
AUTH_SERVICE_TIMEOUT_SECONDS=5.0

CORS_ORIGINS=["http://localhost:3000"]
TODOTAK_EOF

echo '==> Writing notification-service/Dockerfile'
cat > "notification-service/Dockerfile" << 'TODOTAK_EOF'
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# This image serves the HTTP API by default. Run the worker process
# (scheduler + dispatch loops) from the same image with:
#   docker run <image> python -m app.workers.run
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
TODOTAK_EOF

echo '==> Writing notification-service/alembic.ini'
cat > "notification-service/alembic.ini" << 'TODOTAK_EOF'
[alembic]
script_location = alembic
prepend_sys_path = .
version_path_separator = os
sqlalchemy.url = driver://user:pass@localhost/dbname

[post_write_hooks]

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
TODOTAK_EOF

echo '==> Writing notification-service/alembic/env.py'
cat > "notification-service/alembic/env.py" << 'TODOTAK_EOF'
"""Alembic migration environment configured for async SQLAlchemy."""
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.core.config import get_settings
from app.db.base import Base
from app.models import (  # noqa: F401  (ensures models are registered)
    Notification,
    NotificationPreference,
)

config = context.config
settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations without a live DB connection (emits SQL to stdout)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table_schema="notification",
        include_schemas=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table_schema="notification",
        include_schemas=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations against a live async DB connection."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
TODOTAK_EOF

echo '==> Writing notification-service/alembic/script.py.mako'
cat > "notification-service/alembic/script.py.mako" << 'TODOTAK_EOF'
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
TODOTAK_EOF

echo '==> Writing notification-service/alembic/versions/0001_initial_notification_schema.py'
cat > "notification-service/alembic/versions/0001_initial_notification_schema.py" << 'TODOTAK_EOF'
"""initial notification schema

Revision ID: 0001
Revises:
Create Date: 2026-07-14 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


notification_status_enum = postgresql.ENUM(
    "pending",
    "queued",
    "sent",
    "cancelled",
    "failed",
    name="notification_status",
    schema="notification",
)


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS notification")

    bind = op.get_bind()
    notification_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source", sa.String(64), nullable=False),
        sa.Column("source_reference_id", sa.String(64), nullable=False),
        sa.Column("message", sa.String(1024), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            notification_status_enum,
            nullable=False,
            server_default="pending",
        ),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_reason", sa.String(1024), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "source", "source_reference_id", name="uq_notification_source_ref"
        ),
        schema="notification",
    )
    op.create_index(
        "ix_notification_notifications_user_id",
        "notifications",
        ["user_id"],
        schema="notification",
    )
    op.create_index(
        "ix_notification_notifications_scheduled_for",
        "notifications",
        ["scheduled_for"],
        schema="notification",
    )
    op.create_index(
        "ix_notification_notifications_status",
        "notifications",
        ["status"],
        schema="notification",
    )

    op.create_table(
        "notification_preferences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "email_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        schema="notification",
    )
    op.create_index(
        "ix_notification_notification_preferences_user_id",
        "notification_preferences",
        ["user_id"],
        schema="notification",
    )


def downgrade() -> None:
    op.drop_table("notification_preferences", schema="notification")
    op.drop_table("notifications", schema="notification")

    bind = op.get_bind()
    notification_status_enum.drop(bind, checkfirst=True)

    op.execute("DROP SCHEMA IF EXISTS notification CASCADE")
TODOTAK_EOF

echo '==> Writing notification-service/app/__init__.py'
cat > "notification-service/app/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing notification-service/app/api/__init__.py'
cat > "notification-service/app/api/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing notification-service/app/api/deps.py'
cat > "notification-service/app/api/deps.py" << 'TODOTAK_EOF'
"""Shared FastAPI dependencies for the notification-service API layer."""
import uuid
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis, from_url
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import NotificationServiceError
from app.core.security import get_user_id_from_token
from app.db.session import get_db
from app.queue.redis_queue import NotificationQueue
from app.services.notification_service import NotificationService
from app.services.preference_service import PreferenceService

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=False)

_redis_client: Optional[Redis] = None


def get_redis_client() -> Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        bearer_scheme
    ),
) -> uuid.UUID:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        return get_user_id_from_token(credentials.credentials)
    except NotificationServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc


async def get_notification_queue() -> NotificationQueue:
    return NotificationQueue(get_redis_client(), settings.NOTIFICATION_QUEUE_KEY)


async def get_notification_service(
    db: AsyncSession = Depends(get_db),
    queue: NotificationQueue = Depends(get_notification_queue),
) -> NotificationService:
    return NotificationService(db, queue)


async def get_preference_service(
    db: AsyncSession = Depends(get_db),
) -> PreferenceService:
    return PreferenceService(db)
TODOTAK_EOF

echo '==> Writing notification-service/app/api/internal_deps.py'
cat > "notification-service/app/api/internal_deps.py" << 'TODOTAK_EOF'
"""Dependency guarding endpoints only core-service should call directly."""
from typing import Optional

from fastapi import Header, HTTPException, status

from app.core.config import get_settings

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

echo '==> Writing notification-service/app/api/v1/__init__.py'
cat > "notification-service/app/api/v1/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing notification-service/app/api/v1/notifications.py'
cat > "notification-service/app/api/v1/notifications.py" << 'TODOTAK_EOF'
"""Notification API routes.

/schedule and /{source}/{source_reference_id}/cancel are internal —
called directly by core-service, not through the gateway, and guarded
by the shared internal API key rather than a user's access token.

The rest are end-user endpoints, authenticated the same way as every
other service.
"""
import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user_id, get_notification_service
from app.api.internal_deps import verify_internal_api_key
from app.core.exceptions import NotificationServiceError
from app.schemas.common import PageResponse
from app.schemas.notification import (
    NotificationResponse,
    ScheduleNotificationRequest,
)
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post(
    "/schedule",
    response_model=NotificationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_internal_api_key)],
)
async def schedule_notification(
    payload: ScheduleNotificationRequest,
    notification_service: NotificationService = Depends(get_notification_service),
) -> NotificationResponse:
    notification = await notification_service.schedule(payload)
    return NotificationResponse.model_validate(notification)


@router.post(
    "/source/{source}/{source_reference_id}/cancel",
    response_model=NotificationResponse,
    dependencies=[Depends(verify_internal_api_key)],
)
async def cancel_notification(
    source: str,
    source_reference_id: str,
    notification_service: NotificationService = Depends(get_notification_service),
) -> NotificationResponse:
    try:
        notification = await notification_service.cancel(source, source_reference_id)
    except NotificationServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return NotificationResponse.model_validate(notification)


@router.get("", response_model=PageResponse[NotificationResponse])
async def list_notifications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user_id: uuid.UUID = Depends(get_current_user_id),
    notification_service: NotificationService = Depends(get_notification_service),
) -> PageResponse[NotificationResponse]:
    offset = (page - 1) * page_size
    items, total = await notification_service.list_for_user(
        user_id, offset=offset, limit=page_size
    )
    return PageResponse[NotificationResponse](
        items=[NotificationResponse.model_validate(n) for n in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    notification_service: NotificationService = Depends(get_notification_service),
) -> NotificationResponse:
    try:
        notification = await notification_service.get_for_user(
            user_id, notification_id
        )
    except NotificationServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return NotificationResponse.model_validate(notification)
TODOTAK_EOF

echo '==> Writing notification-service/app/api/v1/preferences.py'
cat > "notification-service/app/api/v1/preferences.py" << 'TODOTAK_EOF'
"""Notification preference API routes."""
import uuid

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user_id, get_preference_service
from app.schemas.preference import (
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
)
from app.services.preference_service import PreferenceService

router = APIRouter(prefix="/notifications/preferences", tags=["preferences"])


@router.get("", response_model=NotificationPreferenceResponse)
async def get_preferences(
    user_id: uuid.UUID = Depends(get_current_user_id),
    preference_service: PreferenceService = Depends(get_preference_service),
) -> NotificationPreferenceResponse:
    preference = await preference_service.get_preference(user_id)
    return NotificationPreferenceResponse.model_validate(preference)


@router.patch("", response_model=NotificationPreferenceResponse)
async def update_preferences(
    payload: NotificationPreferenceUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    preference_service: PreferenceService = Depends(get_preference_service),
) -> NotificationPreferenceResponse:
    preference = await preference_service.update_preference(
        user_id, email_enabled=payload.email_enabled
    )
    return NotificationPreferenceResponse.model_validate(preference)
TODOTAK_EOF

echo '==> Writing notification-service/app/clients/__init__.py'
cat > "notification-service/app/clients/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing notification-service/app/clients/auth_service_client.py'
cat > "notification-service/app/clients/auth_service_client.py" << 'TODOTAK_EOF'
"""HTTP client for notification-service -> auth-service communication.

Used only to resolve a user's email address before sending a
notification email. Calls auth-service's internal user-lookup
endpoint directly (not through the gateway), authenticated with the
shared INTERNAL_SERVICE_API_KEY rather than a user's own token, since
this is a service-to-service call with no end-user request in flight.
"""
import logging
import uuid
from typing import Optional

import httpx

from app.core.config import get_settings

logger = logging.getLogger("notification-service.auth_client")
settings = get_settings()


class AuthServiceClient:
    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
        client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self.base_url = (base_url or settings.AUTH_SERVICE_URL).rstrip("/")
        self.timeout = timeout or settings.AUTH_SERVICE_TIMEOUT_SECONDS
        self._client = client

    async def get_user_email(self, user_id: uuid.UUID) -> Optional[str]:
        """Return the user's email, or None if the lookup fails for any reason.

        A missing email should not crash a dispatch attempt — the
        caller falls back to skipping the email channel and the
        in-app notification (the stored row itself) is still valid.
        """
        client = self._client or httpx.AsyncClient()
        owns_client = self._client is None
        try:
            response = await client.get(
                f"{self.base_url}/api/v1/internal/users/{user_id}",
                headers={"X-Internal-Api-Key": settings.INTERNAL_SERVICE_API_KEY},
                timeout=self.timeout,
            )
        except httpx.HTTPError as exc:
            logger.warning("Failed to reach auth-service for user %s: %s", user_id, exc)
            return None
        finally:
            if owns_client:
                await client.aclose()

        if response.status_code != 200:
            logger.warning(
                "auth-service returned %s looking up user %s",
                response.status_code,
                user_id,
            )
            return None

        data = response.json()
        return data.get("email")
TODOTAK_EOF

echo '==> Writing notification-service/app/clients/email_client.py'
cat > "notification-service/app/clients/email_client.py" << 'TODOTAK_EOF'
"""SMTP-based email sender.

smtplib is synchronous; calls are offloaded to a thread via
asyncio.to_thread so they don't block the event loop.
"""
import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

from app.core.config import get_settings
from app.core.exceptions import EmailDispatchError
from app.templates.notification_email import RenderedEmail

logger = logging.getLogger("notification-service.email")
settings = get_settings()


class EmailClient:
    """Sends transactional email via SMTP."""

    def __init__(
        self,
        host: str | None = None,
        port: int | None = None,
        username: str | None = None,
        password: str | None = None,
        use_tls: bool | None = None,
        from_email: str | None = None,
        from_name: str | None = None,
        timeout: float | None = None,
    ) -> None:
        self.host = host or settings.SMTP_HOST
        self.port = port if port is not None else settings.SMTP_PORT
        self.username = username if username is not None else settings.SMTP_USERNAME
        self.password = password if password is not None else settings.SMTP_PASSWORD
        self.use_tls = use_tls if use_tls is not None else settings.SMTP_USE_TLS
        self.from_email = from_email or settings.SMTP_FROM_EMAIL
        self.from_name = from_name or settings.SMTP_FROM_NAME
        self.timeout = timeout or settings.SMTP_TIMEOUT_SECONDS

    async def send(self, *, to_email: str, content: RenderedEmail) -> None:
        try:
            await asyncio.to_thread(self._send_sync, to_email, content)
        except (smtplib.SMTPException, OSError, TimeoutError) as exc:
            logger.warning("Failed to send email to %s: %s", to_email, exc)
            raise EmailDispatchError(str(exc)) from exc

    def _send_sync(self, to_email: str, content: RenderedEmail) -> None:
        message = MIMEMultipart("alternative")
        message["Subject"] = content.subject
        message["From"] = formataddr((self.from_name, self.from_email))
        message["To"] = to_email
        message.attach(MIMEText(content.text_body, "plain"))
        message.attach(MIMEText(content.html_body, "html"))

        with smtplib.SMTP(self.host, self.port, timeout=self.timeout) as server:
            if self.use_tls:
                server.starttls()
            if self.username and self.password:
                server.login(self.username, self.password)
            server.sendmail(self.from_email, [to_email], message.as_string())
TODOTAK_EOF

echo '==> Writing notification-service/app/core/__init__.py'
cat > "notification-service/app/core/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing notification-service/app/core/config.py'
cat > "notification-service/app/core/config.py" << 'TODOTAK_EOF'
"""Application configuration loaded from environment variables."""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the notification-service."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    SERVICE_NAME: str = "notification-service"

    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/3"

    # Must match auth-service's values so end-user access tokens
    # (used by the list-notifications / preferences endpoints) verify
    # here without a network round-trip.
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"

    # Shared secret checked on the internal schedule/cancel endpoints
    # that core-service calls directly (not through the gateway).
    # Prevents an end user from injecting arbitrary notifications for
    # other users even if they can reach this service on the network.
    INTERNAL_SERVICE_API_KEY: str

    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True
    SMTP_FROM_EMAIL: str = "no-reply@todotak.app"
    SMTP_FROM_NAME: str = "Todotak"
    SMTP_TIMEOUT_SECONDS: float = 10.0

    NOTIFICATION_QUEUE_KEY: str = "notifications:dispatch_queue"
    SCHEDULER_POLL_INTERVAL_SECONDS: float = 15.0
    SCHEDULER_BATCH_SIZE: int = 100
    DISPATCH_QUEUE_TIMEOUT_SECONDS: float = 5.0

    AUTH_SERVICE_URL: str = "http://auth-service:8000"
    AUTH_SERVICE_TIMEOUT_SECONDS: float = 5.0

    CORS_ORIGINS: List[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
TODOTAK_EOF

echo '==> Writing notification-service/app/core/exception_handlers.py'
cat > "notification-service/app/core/exception_handlers.py" << 'TODOTAK_EOF'
"""Global exception handlers for the notification-service FastAPI app."""
import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.exceptions import NotificationServiceError

logger = logging.getLogger("notification-service")


def register_exception_handlers(app: FastAPI) -> None:
    """Attach domain, validation, and catch-all exception handlers."""

    @app.exception_handler(NotificationServiceError)
    async def notification_service_error_handler(
        request: Request, exc: NotificationServiceError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code, content={"detail": exc.message}
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": "Validation error", "errors": exc.errors()},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        logger.exception("Unhandled exception in notification-service", exc_info=exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )
TODOTAK_EOF

echo '==> Writing notification-service/app/core/exceptions.py'
cat > "notification-service/app/core/exceptions.py" << 'TODOTAK_EOF'
"""Domain-level exceptions for the notification-service."""


class NotificationServiceError(Exception):
    """Base class for all notification-service domain errors."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class InvalidTokenError(NotificationServiceError):
    """Raised when an access token is missing, invalid, or expired."""

    def __init__(self, message: str = "Invalid or expired token") -> None:
        super().__init__(message, status_code=401)


class InvalidInternalApiKeyError(NotificationServiceError):
    """Raised when a service-to-service call presents a missing/wrong API key."""

    def __init__(self) -> None:
        super().__init__("Invalid or missing internal API key", status_code=401)


class NotFoundError(NotificationServiceError):
    """Raised when a requested resource does not exist."""

    def __init__(self, resource: str = "Resource") -> None:
        super().__init__(f"{resource} not found", status_code=404)


class ForbiddenError(NotificationServiceError):
    """Raised when a user attempts to access a notification they don't own."""

    def __init__(self, message: str = "You do not have access to this resource") -> None:
        super().__init__(message, status_code=403)


class EmailDispatchError(NotificationServiceError):
    """Raised when sending an email via SMTP fails."""

    def __init__(self, message: str = "Failed to send email") -> None:
        super().__init__(message, status_code=502)
TODOTAK_EOF

echo '==> Writing notification-service/app/core/security.py'
cat > "notification-service/app/core/security.py" << 'TODOTAK_EOF'
"""JWT verification for access tokens issued by auth-service."""
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
TODOTAK_EOF

echo '==> Writing notification-service/app/db/__init__.py'
cat > "notification-service/app/db/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing notification-service/app/db/base.py'
cat > "notification-service/app/db/base.py" << 'TODOTAK_EOF'
"""Declarative base class shared by all notification-service ORM models."""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models in this service."""
TODOTAK_EOF

echo '==> Writing notification-service/app/db/session.py'
cat > "notification-service/app/db/session.py" << 'TODOTAK_EOF'
"""Async SQLAlchemy engine and session factory for notification-service."""
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a database session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
TODOTAK_EOF

echo '==> Writing notification-service/app/main.py'
cat > "notification-service/app/main.py" << 'TODOTAK_EOF'
"""Notification-service FastAPI application entrypoint.

This process serves the HTTP API only. The scheduler and dispatch
loops that actually send notifications run as a separate process —
see app/workers/run.py — started with its own command (e.g. a second
container from the same image).
"""
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.notifications import router as notifications_router
from app.api.v1.preferences import router as preferences_router
from app.core.config import get_settings
from app.core.exception_handlers import register_exception_handlers

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Todotak Notification Service",
        description="Schedules and dispatches task/meeting reminder notifications.",
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
    app.include_router(notifications_router, prefix="/api/v1")
    app.include_router(preferences_router, prefix="/api/v1")

    @app.get("/health", tags=["health"])
    async def health_check() -> dict[str, str]:
        return {"status": "ok", "service": settings.SERVICE_NAME}

    return app


app = create_app()
TODOTAK_EOF

echo '==> Writing notification-service/app/models/__init__.py'
cat > "notification-service/app/models/__init__.py" << 'TODOTAK_EOF'
"""ORM models package.

Every model is imported here so that Base.metadata is fully populated
when Alembic (or anything else) imports app.models.
"""
from app.models.notification import Notification, NotificationStatus
from app.models.notification_preference import NotificationPreference

__all__ = ["Notification", "NotificationStatus", "NotificationPreference"]
TODOTAK_EOF

echo '==> Writing notification-service/app/models/notification.py'
cat > "notification-service/app/models/notification.py" << 'TODOTAK_EOF'
"""Notification ORM model for the notification schema."""
import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, String, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class NotificationStatus(str, enum.Enum):
    PENDING = "pending"
    QUEUED = "queued"
    SENT = "sent"
    CANCELLED = "cancelled"
    FAILED = "failed"


class Notification(Base):
    """A notification scheduled by an upstream service (e.g. core-service).

    `source` + `source_reference_id` identify the originating record
    (e.g. source="core-service", source_reference_id=<reminder id>) so
    that a later re-schedule or cancel call can find and update the
    same row instead of creating duplicates.
    """

    __tablename__ = "notifications"
    __table_args__ = (
        UniqueConstraint(
            "source", "source_reference_id", name="uq_notification_source_ref"
        ),
        {"schema": "notification"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    source: Mapped[str] = mapped_column(String(64), nullable=False)
    source_reference_id: Mapped[str] = mapped_column(String(64), nullable=False)
    message: Mapped[str] = mapped_column(String(1024), nullable=False)
    scheduled_for: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    status: Mapped[NotificationStatus] = mapped_column(
        SAEnum(NotificationStatus, name="notification_status", schema="notification"),
        default=NotificationStatus.PENDING,
        nullable=False,
        index=True,
    )
    sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    failure_reason: Mapped[Optional[str]] = mapped_column(
        String(1024), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        onupdate=_utcnow,
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<Notification id={self.id} source={self.source!r} "
            f"status={self.status}>"
        )
TODOTAK_EOF

echo '==> Writing notification-service/app/models/notification_preference.py'
cat > "notification-service/app/models/notification_preference.py" << 'TODOTAK_EOF'
"""NotificationPreference ORM model for the notification schema."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class NotificationPreference(Base):
    """Per-user opt-in/out settings for notification channels.

    In-app notifications (the stored Notification rows themselves,
    surfaced via GET /api/v1/notifications) are always on — there's no
    separate delivery step for them. This only controls whether an
    email is additionally sent.
    """

    __tablename__ = "notification_preferences"
    __table_args__ = {"schema": "notification"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, nullable=False, index=True
    )
    email_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        onupdate=_utcnow,
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<NotificationPreference user_id={self.user_id} "
            f"email_enabled={self.email_enabled}>"
        )
TODOTAK_EOF

echo '==> Writing notification-service/app/queue/__init__.py'
cat > "notification-service/app/queue/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing notification-service/app/queue/redis_queue.py'
cat > "notification-service/app/queue/redis_queue.py" << 'TODOTAK_EOF'
"""Redis-backed queue carrying notification ids awaiting dispatch.

The scheduler worker pushes ids onto this queue once a notification's
scheduled_for time arrives; the dispatch worker blocks on it and sends
each notification as it appears. Using a queue rather than pure DB
polling in the dispatch worker means dispatch happens immediately
after the scheduler claims a batch, not on the next poll interval.
"""
import uuid
from typing import Optional

from redis.asyncio import Redis


class NotificationQueue:
    def __init__(self, redis_client: Redis, queue_key: str) -> None:
        self.redis = redis_client
        self.queue_key = queue_key

    async def enqueue(self, notification_id: uuid.UUID) -> None:
        await self.redis.lpush(self.queue_key, str(notification_id))

    async def enqueue_many(self, notification_ids: list[uuid.UUID]) -> None:
        if not notification_ids:
            return
        await self.redis.lpush(
            self.queue_key, *[str(nid) for nid in notification_ids]
        )

    async def dequeue(self, timeout_seconds: float) -> Optional[uuid.UUID]:
        """Block up to timeout_seconds waiting for an id; None on timeout."""
        result = await self.redis.brpop(self.queue_key, timeout=timeout_seconds)
        if result is None:
            return None
        _, raw_id = result
        try:
            return uuid.UUID(
                raw_id.decode() if isinstance(raw_id, bytes) else raw_id
            )
        except ValueError:
            return None
TODOTAK_EOF

echo '==> Writing notification-service/app/repositories/__init__.py'
cat > "notification-service/app/repositories/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing notification-service/app/repositories/notification_preference_repository.py'
cat > "notification-service/app/repositories/notification_preference_repository.py" << 'TODOTAK_EOF'
"""Data access layer for the NotificationPreference model."""
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification_preference import NotificationPreference


class NotificationPreferenceRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_user_id(
        self, user_id: uuid.UUID
    ) -> Optional[NotificationPreference]:
        result = await self.db.execute(
            select(NotificationPreference).where(
                NotificationPreference.user_id == user_id
            )
        )
        return result.scalar_one_or_none()

    async def get_or_create(self, user_id: uuid.UUID) -> NotificationPreference:
        existing = await self.get_by_user_id(user_id)
        if existing is not None:
            return existing

        preference = NotificationPreference(user_id=user_id)
        self.db.add(preference)
        await self.db.flush()
        await self.db.refresh(preference)
        return preference

    async def update(
        self, preference: NotificationPreference, *, email_enabled: bool
    ) -> NotificationPreference:
        preference.email_enabled = email_enabled
        await self.db.flush()
        await self.db.refresh(preference)
        return preference
TODOTAK_EOF

echo '==> Writing notification-service/app/repositories/notification_repository.py'
cat > "notification-service/app/repositories/notification_repository.py" << 'TODOTAK_EOF'
"""Data access layer for the Notification model."""
import uuid
from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationStatus


class NotificationRepository:
    """Encapsulates all database access for Notification rows."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, notification_id: uuid.UUID) -> Optional[Notification]:
        result = await self.db.execute(
            select(Notification).where(Notification.id == notification_id)
        )
        return result.scalar_one_or_none()

    async def get_by_source(
        self, source: str, source_reference_id: str
    ) -> Optional[Notification]:
        result = await self.db.execute(
            select(Notification).where(
                Notification.source == source,
                Notification.source_reference_id == source_reference_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_for_user(
        self, user_id: uuid.UUID, *, offset: int, limit: int
    ) -> Tuple[List[Notification], int]:
        stmt = select(Notification).where(Notification.user_id == user_id)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = (
            stmt.order_by(Notification.scheduled_for.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def upsert(
        self,
        *,
        source: str,
        source_reference_id: str,
        user_id: uuid.UUID,
        scheduled_for: datetime,
        message: str,
    ) -> Notification:
        existing = await self.get_by_source(source, source_reference_id)
        if existing is not None:
            existing.scheduled_for = scheduled_for
            existing.message = message
            existing.status = NotificationStatus.PENDING
            existing.sent_at = None
            existing.failure_reason = None
            await self.db.flush()
            await self.db.refresh(existing)
            return existing

        notification = Notification(
            source=source,
            source_reference_id=source_reference_id,
            user_id=user_id,
            scheduled_for=scheduled_for,
            message=message,
        )
        self.db.add(notification)
        await self.db.flush()
        await self.db.refresh(notification)
        return notification

    async def cancel_by_source(
        self, source: str, source_reference_id: str
    ) -> Optional[Notification]:
        notification = await self.get_by_source(source, source_reference_id)
        if notification is None or notification.status in (
            NotificationStatus.SENT,
            NotificationStatus.CANCELLED,
        ):
            return notification
        notification.status = NotificationStatus.CANCELLED
        await self.db.flush()
        await self.db.refresh(notification)
        return notification

    async def claim_due(
        self, *, before: datetime, limit: int
    ) -> List[uuid.UUID]:
        """Atomically transition due, pending notifications to QUEUED.

        Uses a single UPDATE ... RETURNING so that if multiple
        scheduler instances run concurrently, each due notification is
        claimed by exactly one of them.
        """
        subquery = (
            select(Notification.id)
            .where(
                Notification.status == NotificationStatus.PENDING,
                Notification.scheduled_for <= before,
            )
            .order_by(Notification.scheduled_for.asc())
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        stmt = (
            update(Notification)
            .where(Notification.id.in_(subquery))
            .values(status=NotificationStatus.QUEUED)
            .returning(Notification.id)
        )
        result = await self.db.execute(stmt)
        ids = [row[0] for row in result.all()]
        await self.db.commit()
        return ids

    async def mark_sent(self, notification: Notification, sent_at: datetime) -> Notification:
        notification.status = NotificationStatus.SENT
        notification.sent_at = sent_at
        notification.failure_reason = None
        await self.db.flush()
        await self.db.refresh(notification)
        return notification

    async def mark_failed(
        self, notification: Notification, reason: str
    ) -> Notification:
        notification.status = NotificationStatus.FAILED
        notification.failure_reason = reason[:1024]
        await self.db.flush()
        await self.db.refresh(notification)
        return notification
TODOTAK_EOF

echo '==> Writing notification-service/app/schemas/__init__.py'
cat > "notification-service/app/schemas/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing notification-service/app/schemas/common.py'
cat > "notification-service/app/schemas/common.py" << 'TODOTAK_EOF'
"""Shared pagination response schema."""
from typing import Generic, List, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PageResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int
TODOTAK_EOF

echo '==> Writing notification-service/app/schemas/notification.py'
cat > "notification-service/app/schemas/notification.py" << 'TODOTAK_EOF'
"""Pydantic schemas for notification resources."""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.notification import NotificationStatus


class ScheduleNotificationRequest(BaseModel):
    """Payload sent by an upstream service (e.g. core-service) to schedule
    or re-schedule a notification. `source` + `source_reference_id`
    together identify the originating record so re-sends upsert
    instead of duplicating.
    """

    source: str = Field(min_length=1, max_length=64)
    source_reference_id: str = Field(min_length=1, max_length=64)
    user_id: uuid.UUID
    scheduled_for: datetime
    message: str = Field(min_length=1, max_length=1024)


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    source: str
    source_reference_id: str
    message: str
    scheduled_for: datetime
    status: NotificationStatus
    sent_at: Optional[datetime]
    failure_reason: Optional[str]
    created_at: datetime
    updated_at: datetime
TODOTAK_EOF

echo '==> Writing notification-service/app/schemas/preference.py'
cat > "notification-service/app/schemas/preference.py" << 'TODOTAK_EOF'
"""Pydantic schemas for notification preference resources."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationPreferenceUpdate(BaseModel):
    email_enabled: bool


class NotificationPreferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    email_enabled: bool
    updated_at: datetime
TODOTAK_EOF

echo '==> Writing notification-service/app/services/__init__.py'
cat > "notification-service/app/services/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing notification-service/app/services/dispatch_service.py'
cat > "notification-service/app/services/dispatch_service.py" << 'TODOTAK_EOF'
"""Delivers a single queued notification: email (if enabled and an
address is on file) plus marking the row sent so it's visible via the
in-app notifications list either way.
"""
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.auth_service_client import AuthServiceClient
from app.clients.email_client import EmailClient
from app.core.exceptions import EmailDispatchError
from app.models.notification import NotificationStatus
from app.repositories.notification_preference_repository import (
    NotificationPreferenceRepository,
)
from app.repositories.notification_repository import NotificationRepository
from app.templates.notification_email import render_reminder_email

logger = logging.getLogger("notification-service.dispatch")


class DispatchService:
    def __init__(
        self,
        db: AsyncSession,
        email_client: EmailClient,
        auth_client: AuthServiceClient,
    ) -> None:
        self.db = db
        self.notifications = NotificationRepository(db)
        self.preferences = NotificationPreferenceRepository(db)
        self.email_client = email_client
        self.auth_client = auth_client

    async def dispatch(self, notification_id: uuid.UUID) -> None:
        notification = await self.notifications.get_by_id(notification_id)
        if notification is None:
            logger.warning("Notification %s not found; skipping", notification_id)
            return

        if notification.status != NotificationStatus.QUEUED:
            # Already dispatched or cancelled between being claimed
            # and reaching the front of the queue.
            logger.info(
                "Notification %s is %s, not QUEUED; skipping",
                notification_id,
                notification.status,
            )
            return

        preference = await self.preferences.get_or_create(notification.user_id)
        await self.db.commit()

        if preference.email_enabled:
            email = await self.auth_client.get_user_email(notification.user_id)
            if email:
                try:
                    content = render_reminder_email(notification.message)
                    await self.email_client.send(to_email=email, content=content)
                except EmailDispatchError as exc:
                    await self.notifications.mark_failed(notification, str(exc))
                    await self.db.commit()
                    return
            else:
                logger.warning(
                    "No email on file for user %s; sending in-app only",
                    notification.user_id,
                )

        await self.notifications.mark_sent(notification, datetime.now(timezone.utc))
        await self.db.commit()
TODOTAK_EOF

echo '==> Writing notification-service/app/services/notification_service.py'
cat > "notification-service/app/services/notification_service.py" << 'TODOTAK_EOF'
"""Business logic for scheduling, cancelling, and listing notifications."""
import uuid
from datetime import datetime, timezone
from typing import List, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.notification import Notification, NotificationStatus
from app.queue.redis_queue import NotificationQueue
from app.repositories.notification_repository import NotificationRepository
from app.schemas.notification import ScheduleNotificationRequest


class NotificationService:
    """Orchestrates notification scheduling for the internal API."""

    def __init__(self, db: AsyncSession, queue: NotificationQueue) -> None:
        self.db = db
        self.notifications = NotificationRepository(db)
        self.queue = queue

    async def schedule(self, payload: ScheduleNotificationRequest) -> Notification:
        notification = await self.notifications.upsert(
            source=payload.source,
            source_reference_id=payload.source_reference_id,
            user_id=payload.user_id,
            scheduled_for=payload.scheduled_for,
            message=payload.message,
        )
        await self.db.commit()

        # If the requested time has already passed (or is within this
        # instant), dispatch it immediately rather than waiting for
        # the next scheduler poll.
        now = datetime.now(timezone.utc)
        if (
            notification.scheduled_for.replace(tzinfo=timezone.utc) <= now
            and notification.status == NotificationStatus.PENDING
        ):
            notification.status = NotificationStatus.QUEUED
            await self.db.flush()
            await self.db.commit()
            await self.queue.enqueue(notification.id)

        return notification

    async def cancel(self, source: str, source_reference_id: str) -> Notification:
        notification = await self.notifications.cancel_by_source(
            source, source_reference_id
        )
        if notification is None:
            raise NotFoundError("Notification")
        await self.db.commit()
        return notification

    async def get_for_user(
        self, user_id: uuid.UUID, notification_id: uuid.UUID
    ) -> Notification:
        notification = await self.notifications.get_by_id(notification_id)
        if notification is None:
            raise NotFoundError("Notification")
        if notification.user_id != user_id:
            raise ForbiddenError("You do not have access to this notification")
        return notification

    async def list_for_user(
        self, user_id: uuid.UUID, *, offset: int, limit: int
    ) -> Tuple[List[Notification], int]:
        return await self.notifications.list_for_user(
            user_id, offset=offset, limit=limit
        )
TODOTAK_EOF

echo '==> Writing notification-service/app/services/preference_service.py'
cat > "notification-service/app/services/preference_service.py" << 'TODOTAK_EOF'
"""Business logic for notification preferences."""
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification_preference import NotificationPreference
from app.repositories.notification_preference_repository import (
    NotificationPreferenceRepository,
)


class PreferenceService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.preferences = NotificationPreferenceRepository(db)

    async def get_preference(self, user_id: uuid.UUID) -> NotificationPreference:
        preference = await self.preferences.get_or_create(user_id)
        await self.db.commit()
        return preference

    async def update_preference(
        self, user_id: uuid.UUID, *, email_enabled: bool
    ) -> NotificationPreference:
        preference = await self.preferences.get_or_create(user_id)
        preference = await self.preferences.update(
            preference, email_enabled=email_enabled
        )
        await self.db.commit()
        return preference
TODOTAK_EOF

echo '==> Writing notification-service/app/templates/__init__.py'
cat > "notification-service/app/templates/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing notification-service/app/templates/notification_email.py'
cat > "notification-service/app/templates/notification_email.py" << 'TODOTAK_EOF'
"""Renders subject/HTML/plain-text bodies for notification emails.

Kept as plain Python string building rather than a full templating
engine — the content here is a single short notice, not a document,
so the added dependency and indirection of Jinja2 wouldn't earn its
keep.
"""
from dataclasses import dataclass


@dataclass
class RenderedEmail:
    subject: str
    html_body: str
    text_body: str


def render_reminder_email(message: str) -> RenderedEmail:
    subject = "Todotak reminder"
    text_body = f"{message}\n\n— Todotak"
    html_body = f"""\
<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, sans-serif; background:#F5F6F3; padding:24px;">
    <table role="presentation" width="100%" style="max-width:480px; margin:0 auto; background:#FFFFFF; border:1px solid #E4E6E1; border-radius:4px;">
      <tr>
        <td style="padding:24px;">
          <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:#8A9A8E;">
            Todotak reminder
          </p>
          <p style="margin:0; font-size:16px; line-height:1.5; color:#20241F;">
            {message}
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
"""
    return RenderedEmail(subject=subject, html_body=html_body, text_body=text_body)
TODOTAK_EOF

echo '==> Writing notification-service/app/workers/__init__.py'
cat > "notification-service/app/workers/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing notification-service/app/workers/dispatch_worker.py'
cat > "notification-service/app/workers/dispatch_worker.py" << 'TODOTAK_EOF'
"""Blocks on the dispatch queue and sends each notification as it
arrives — email (if enabled) plus marking the row sent.
"""
import asyncio
import logging

from app.clients.auth_service_client import AuthServiceClient
from app.clients.email_client import EmailClient
from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.queue.redis_queue import NotificationQueue
from app.services.dispatch_service import DispatchService

logger = logging.getLogger("notification-service.dispatch_worker")
settings = get_settings()


async def run_dispatch_loop(queue: NotificationQueue) -> None:
    """Run forever: block on the queue, dispatch each id as it appears."""
    email_client = EmailClient()
    auth_client = AuthServiceClient()

    while True:
        try:
            notification_id = await queue.dequeue(
                timeout_seconds=settings.DISPATCH_QUEUE_TIMEOUT_SECONDS
            )
        except Exception:  # noqa: BLE001
            logger.exception("Failed to read from dispatch queue; retrying")
            await asyncio.sleep(1)
            continue

        if notification_id is None:
            continue  # timed out waiting; loop and block again

        try:
            async with AsyncSessionLocal() as db:
                dispatch_service = DispatchService(db, email_client, auth_client)
                await dispatch_service.dispatch(notification_id)
        except Exception:  # noqa: BLE001
            logger.exception(
                "Failed to dispatch notification %s", notification_id
            )
TODOTAK_EOF

echo '==> Writing notification-service/app/workers/run.py'
cat > "notification-service/app/workers/run.py" << 'TODOTAK_EOF'
"""Entrypoint for the notification-service worker process.

Run as a separate process/container from the HTTP API, e.g.:

    python -m app.workers.run

Both loops run concurrently in one process since they're both
lightweight and I/O-bound; split them into separate processes later
if either becomes a bottleneck.
"""
import asyncio
import logging

from redis.asyncio import from_url

from app.core.config import get_settings
from app.queue.redis_queue import NotificationQueue
from app.workers.dispatch_worker import run_dispatch_loop
from app.workers.scheduler_worker import run_scheduler_loop

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("notification-service.worker")
settings = get_settings()


async def main() -> None:
    redis_client = from_url(settings.REDIS_URL, decode_responses=True)
    queue = NotificationQueue(redis_client, settings.NOTIFICATION_QUEUE_KEY)

    logger.info("Starting notification-service worker (scheduler + dispatch)")
    try:
        await asyncio.gather(
            run_scheduler_loop(queue),
            run_dispatch_loop(queue),
        )
    finally:
        await redis_client.aclose()


if __name__ == "__main__":
    asyncio.run(main())
TODOTAK_EOF

echo '==> Writing notification-service/app/workers/scheduler_worker.py'
cat > "notification-service/app/workers/scheduler_worker.py" << 'TODOTAK_EOF'
"""Periodically claims notifications whose scheduled_for time has
arrived and pushes them onto the dispatch queue.

Runs as an independent long-lived loop, separate from both the HTTP
API process and the dispatch worker, so a slow SMTP server never
delays claiming newly-due notifications.
"""
import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.queue.redis_queue import NotificationQueue
from app.repositories.notification_repository import NotificationRepository

logger = logging.getLogger("notification-service.scheduler_worker")
settings = get_settings()


async def run_scheduler_once(db: AsyncSession, queue: NotificationQueue) -> int:
    """Claim one batch of due notifications and enqueue them.

    Returns the number of notifications claimed, for logging/tests.
    """
    repository = NotificationRepository(db)
    claimed_ids = await repository.claim_due(
        before=datetime.now(timezone.utc),
        limit=settings.SCHEDULER_BATCH_SIZE,
    )
    if claimed_ids:
        await queue.enqueue_many(claimed_ids)
        logger.info("Claimed and enqueued %d due notification(s)", len(claimed_ids))
    return len(claimed_ids)


async def run_scheduler_loop(queue: NotificationQueue) -> None:
    """Run run_scheduler_once forever, sleeping between polls."""
    while True:
        try:
            async with AsyncSessionLocal() as db:
                await run_scheduler_once(db, queue)
        except Exception:  # noqa: BLE001
            logger.exception("Scheduler poll failed; will retry next interval")
        await asyncio.sleep(settings.SCHEDULER_POLL_INTERVAL_SECONDS)
TODOTAK_EOF

echo '==> Writing notification-service/requirements.txt'
cat > "notification-service/requirements.txt" << 'TODOTAK_EOF'
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy==2.0.35
asyncpg==0.29.0
alembic==1.13.2
pydantic==2.9.2
pydantic-settings==2.5.2
python-jose[cryptography]==3.3.0
python-multipart==0.0.9
httpx==0.27.2
redis==5.0.8
pytest==8.3.3
pytest-asyncio==0.24.0
fakeredis==2.24.1
TODOTAK_EOF

echo '==> Writing notification-service/tests/__init__.py'
cat > "notification-service/tests/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing notification-service/tests/conftest.py'
cat > "notification-service/tests/conftest.py" << 'TODOTAK_EOF'
"""Shared pytest fixtures for notification-service tests that need a
database. Requires TEST_DATABASE_URL pointed at a disposable Postgres
instance; the notification schema/tables are created and torn down by
the db_session fixture. Tests in test_redis_queue.py,
test_email_templates.py, test_auth_service_client.py, and
test_email_client.py do not use this file's fixtures and run without
any external infrastructure.
"""
import asyncio
import os
import uuid
from datetime import timedelta
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from asgi_lifespan import LifespanManager
from fakeredis import FakeAsyncRedis
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
from app.models import Notification, NotificationPreference  # noqa: E402,F401
from app.queue.redis_queue import NotificationQueue  # noqa: E402


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
            __import__("sqlalchemy").text(
                "CREATE SCHEMA IF NOT EXISTS notification"
            )
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
async def fake_redis() -> AsyncGenerator[FakeAsyncRedis, None]:
    client = FakeAsyncRedis()
    yield client
    await client.aclose()


@pytest_asyncio.fixture
async def notification_queue(fake_redis: FakeAsyncRedis) -> NotificationQueue:
    return NotificationQueue(fake_redis, "test:notifications:dispatch_queue")


@pytest_asyncio.fixture
async def app_client(
    db_session: AsyncSession, fake_redis: FakeAsyncRedis
) -> AsyncGenerator[AsyncClient, None]:
    import app.api.deps as deps_module

    app = create_app()

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    # Route the queue dependency at the module level so every request
    # in this test uses the same fakeredis instance.
    original_get_redis = deps_module.get_redis_client
    deps_module.get_redis_client = lambda: fake_redis

    async with LifespanManager(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport, base_url="http://testserver"
        ) as client:
            yield client

    deps_module.get_redis_client = original_get_redis
    app.dependency_overrides.clear()


@pytest.fixture
def test_user_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def auth_headers(test_user_id: uuid.UUID) -> dict:
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


@pytest.fixture
def internal_headers() -> dict:
    settings = get_settings()
    return {"X-Internal-Api-Key": settings.INTERNAL_SERVICE_API_KEY}
TODOTAK_EOF

echo '==> Writing notification-service/tests/test_auth_service_client.py'
cat > "notification-service/tests/test_auth_service_client.py" << 'TODOTAK_EOF'
"""Unit tests for AuthServiceClient.

Uses httpx.MockTransport in place of a real auth-service, so these
run with no database and no real network access.
"""
import os
import uuid

import httpx
import pytest

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-unit-tests-only")
os.environ.setdefault("INTERNAL_SERVICE_API_KEY", "test-internal-key")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/unused"
)

from app.clients.auth_service_client import AuthServiceClient  # noqa: E402

pytestmark = pytest.mark.asyncio


def _client_with_handler(handler) -> AuthServiceClient:
    http_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return AuthServiceClient(
        base_url="http://auth-service:8000", client=http_client
    )


async def test_get_user_email_returns_email_on_success() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"email": "ali@example.com"})

    client = _client_with_handler(handler)
    email = await client.get_user_email(uuid.uuid4())
    assert email == "ali@example.com"


async def test_get_user_email_sends_internal_api_key_header() -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["header"] = request.headers.get("x-internal-api-key")
        return httpx.Response(200, json={"email": "a@example.com"})

    client = _client_with_handler(handler)
    await client.get_user_email(uuid.uuid4())
    assert captured["header"] == "test-internal-key"


async def test_get_user_email_returns_none_on_404() -> None:
    client = _client_with_handler(lambda r: httpx.Response(404))
    email = await client.get_user_email(uuid.uuid4())
    assert email is None


async def test_get_user_email_returns_none_on_connection_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    client = _client_with_handler(handler)
    email = await client.get_user_email(uuid.uuid4())
    assert email is None


async def test_get_user_email_requests_correct_path() -> None:
    captured = {}
    user_id = uuid.uuid4()

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        return httpx.Response(200, json={"email": "x@example.com"})

    client = _client_with_handler(handler)
    await client.get_user_email(user_id)
    assert captured["path"] == f"/api/v1/internal/users/{user_id}"
TODOTAK_EOF

echo '==> Writing notification-service/tests/test_dispatch_service.py'
cat > "notification-service/tests/test_dispatch_service.py" << 'TODOTAK_EOF'
"""Integration tests for DispatchService.

Requires TEST_DATABASE_URL (see conftest.py). The email and auth
clients are faked, so no real SMTP server or auth-service is needed.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import EmailDispatchError
from app.models.notification import NotificationStatus
from app.repositories.notification_preference_repository import (
    NotificationPreferenceRepository,
)
from app.repositories.notification_repository import NotificationRepository
from app.services.dispatch_service import DispatchService

pytestmark = pytest.mark.asyncio


class FakeAuthClient:
    def __init__(self, email: Optional[str] = "user@example.com") -> None:
        self.email = email
        self.calls: List[uuid.UUID] = []

    async def get_user_email(self, user_id: uuid.UUID) -> Optional[str]:
        self.calls.append(user_id)
        return self.email


class FakeEmailClient:
    def __init__(self, should_fail: bool = False) -> None:
        self.should_fail = should_fail
        self.sent: List[tuple] = []

    async def send(self, *, to_email: str, content) -> None:
        if self.should_fail:
            raise EmailDispatchError("smtp down")
        self.sent.append((to_email, content))


async def _create_queued_notification(
    db_session: AsyncSession, *, user_id: uuid.UUID
):
    repository = NotificationRepository(db_session)
    notification = await repository.upsert(
        source="core-service",
        source_reference_id=str(uuid.uuid4()),
        user_id=user_id,
        scheduled_for=datetime.now(timezone.utc) - timedelta(minutes=1),
        message="Dispatch me",
    )
    notification.status = NotificationStatus.QUEUED
    await db_session.flush()
    await db_session.commit()
    return notification


async def test_dispatch_sends_email_and_marks_sent(db_session: AsyncSession) -> None:
    user_id = uuid.uuid4()
    notification = await _create_queued_notification(db_session, user_id=user_id)

    auth_client = FakeAuthClient(email="user@example.com")
    email_client = FakeEmailClient()
    service = DispatchService(db_session, email_client, auth_client)

    await service.dispatch(notification.id)

    await db_session.refresh(notification)
    assert notification.status == NotificationStatus.SENT
    assert notification.sent_at is not None
    assert len(email_client.sent) == 1
    assert email_client.sent[0][0] == "user@example.com"


async def test_dispatch_skips_email_when_preference_disabled(
    db_session: AsyncSession,
) -> None:
    user_id = uuid.uuid4()
    preferences = NotificationPreferenceRepository(db_session)
    pref = await preferences.get_or_create(user_id)
    await preferences.update(pref, email_enabled=False)
    await db_session.commit()

    notification = await _create_queued_notification(db_session, user_id=user_id)

    auth_client = FakeAuthClient()
    email_client = FakeEmailClient()
    service = DispatchService(db_session, email_client, auth_client)

    await service.dispatch(notification.id)

    await db_session.refresh(notification)
    assert notification.status == NotificationStatus.SENT
    assert email_client.sent == []
    assert auth_client.calls == []


async def test_dispatch_still_marks_sent_when_no_email_on_file(
    db_session: AsyncSession,
) -> None:
    user_id = uuid.uuid4()
    notification = await _create_queued_notification(db_session, user_id=user_id)

    auth_client = FakeAuthClient(email=None)
    email_client = FakeEmailClient()
    service = DispatchService(db_session, email_client, auth_client)

    await service.dispatch(notification.id)

    await db_session.refresh(notification)
    assert notification.status == NotificationStatus.SENT
    assert email_client.sent == []


async def test_dispatch_marks_failed_when_email_send_raises(
    db_session: AsyncSession,
) -> None:
    user_id = uuid.uuid4()
    notification = await _create_queued_notification(db_session, user_id=user_id)

    auth_client = FakeAuthClient(email="user@example.com")
    email_client = FakeEmailClient(should_fail=True)
    service = DispatchService(db_session, email_client, auth_client)

    await service.dispatch(notification.id)

    await db_session.refresh(notification)
    assert notification.status == NotificationStatus.FAILED
    assert notification.failure_reason is not None


async def test_dispatch_ignores_notification_not_in_queued_state(
    db_session: AsyncSession,
) -> None:
    repository = NotificationRepository(db_session)
    notification = await repository.upsert(
        source="core-service",
        source_reference_id=str(uuid.uuid4()),
        user_id=uuid.uuid4(),
        scheduled_for=datetime.now(timezone.utc) + timedelta(hours=1),
        message="Still pending",
    )
    await db_session.commit()  # status stays PENDING, not QUEUED

    auth_client = FakeAuthClient()
    email_client = FakeEmailClient()
    service = DispatchService(db_session, email_client, auth_client)

    await service.dispatch(notification.id)

    await db_session.refresh(notification)
    assert notification.status == NotificationStatus.PENDING
    assert email_client.sent == []


async def test_dispatch_handles_unknown_notification_id_gracefully(
    db_session: AsyncSession,
) -> None:
    service = DispatchService(db_session, FakeEmailClient(), FakeAuthClient())
    # Should not raise.
    await service.dispatch(uuid.uuid4())
TODOTAK_EOF

echo '==> Writing notification-service/tests/test_email_client.py'
cat > "notification-service/tests/test_email_client.py" << 'TODOTAK_EOF'
"""Unit tests for EmailClient.

Stubs out smtplib.SMTP entirely, so these run with no real SMTP server,
database, or network access.
"""
import os
import smtplib

import pytest

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-unit-tests-only")
os.environ.setdefault("INTERNAL_SERVICE_API_KEY", "test-internal-key")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/unused"
)

from app.clients.email_client import EmailClient  # noqa: E402
from app.core.exceptions import EmailDispatchError  # noqa: E402
from app.templates.notification_email import render_reminder_email  # noqa: E402

pytestmark = pytest.mark.asyncio


class FakeSMTP:
    """Stand-in for smtplib.SMTP capturing calls instead of connecting."""

    instances: list["FakeSMTP"] = []

    def __init__(self, host, port, timeout=None):
        self.host = host
        self.port = port
        self.started_tls = False
        self.login_args = None
        self.sent = None
        FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False

    def starttls(self):
        self.started_tls = True

    def login(self, username, password):
        self.login_args = (username, password)

    def sendmail(self, from_addr, to_addrs, message):
        self.sent = (from_addr, to_addrs, message)


class RaisingSMTP(FakeSMTP):
    def sendmail(self, from_addr, to_addrs, message):
        raise smtplib.SMTPException("mailbox full")


@pytest.fixture(autouse=True)
def reset_instances():
    FakeSMTP.instances.clear()
    yield
    FakeSMTP.instances.clear()


async def test_send_uses_configured_host_and_port(monkeypatch) -> None:
    monkeypatch.setattr("app.clients.email_client.smtplib.SMTP", FakeSMTP)
    client = EmailClient(
        host="smtp.example.com", port=2525, use_tls=False, from_email="a@x.com"
    )

    await client.send(
        to_email="user@example.com", content=render_reminder_email("hi")
    )

    assert len(FakeSMTP.instances) == 1
    assert FakeSMTP.instances[0].host == "smtp.example.com"
    assert FakeSMTP.instances[0].port == 2525


async def test_send_starts_tls_when_enabled(monkeypatch) -> None:
    monkeypatch.setattr("app.clients.email_client.smtplib.SMTP", FakeSMTP)
    client = EmailClient(use_tls=True)

    await client.send(
        to_email="user@example.com", content=render_reminder_email("hi")
    )

    assert FakeSMTP.instances[0].started_tls is True


async def test_send_logs_in_when_credentials_provided(monkeypatch) -> None:
    monkeypatch.setattr("app.clients.email_client.smtplib.SMTP", FakeSMTP)
    client = EmailClient(username="user", password="pass", use_tls=False)

    await client.send(
        to_email="user@example.com", content=render_reminder_email("hi")
    )

    assert FakeSMTP.instances[0].login_args == ("user", "pass")


async def test_send_delivers_to_the_given_recipient(monkeypatch) -> None:
    monkeypatch.setattr("app.clients.email_client.smtplib.SMTP", FakeSMTP)
    client = EmailClient(use_tls=False)

    await client.send(
        to_email="recipient@example.com",
        content=render_reminder_email("Don't forget"),
    )

    from_addr, to_addrs, message = FakeSMTP.instances[0].sent
    assert to_addrs == ["recipient@example.com"]
    assert "Don't forget" in message


async def test_send_raises_email_dispatch_error_on_smtp_failure(monkeypatch) -> None:
    monkeypatch.setattr("app.clients.email_client.smtplib.SMTP", RaisingSMTP)
    client = EmailClient(use_tls=False)

    with pytest.raises(EmailDispatchError):
        await client.send(
            to_email="user@example.com", content=render_reminder_email("hi")
        )
TODOTAK_EOF

echo '==> Writing notification-service/tests/test_email_templates.py'
cat > "notification-service/tests/test_email_templates.py" << 'TODOTAK_EOF'
"""Unit tests for notification email rendering."""
from app.templates.notification_email import render_reminder_email


def test_render_reminder_email_includes_message_in_both_bodies() -> None:
    result = render_reminder_email("Call the bank at 3pm")

    assert "Call the bank at 3pm" in result.text_body
    assert "Call the bank at 3pm" in result.html_body


def test_render_reminder_email_has_a_subject() -> None:
    result = render_reminder_email("Anything")
    assert result.subject == "Todotak reminder"


def test_render_reminder_email_html_is_well_formed_enough() -> None:
    result = render_reminder_email("Test message")
    assert result.html_body.strip().startswith("<!DOCTYPE html>")
    assert "</html>" in result.html_body


def test_render_reminder_email_escapes_nothing_special_but_preserves_content() -> None:
    message = "Pick up documents & sign by 5pm"
    result = render_reminder_email(message)
    assert message in result.text_body
TODOTAK_EOF

echo '==> Writing notification-service/tests/test_notification_service.py'
cat > "notification-service/tests/test_notification_service.py" << 'TODOTAK_EOF'
"""Integration tests for NotificationService.

Requires TEST_DATABASE_URL (see conftest.py). Uses fakeredis for the
dispatch queue, so no real Redis is needed even though the database
is real.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import NotificationStatus
from app.queue.redis_queue import NotificationQueue
from app.schemas.notification import ScheduleNotificationRequest
from app.services.notification_service import NotificationService

pytestmark = pytest.mark.asyncio


async def test_schedule_creates_pending_notification_for_future_time(
    db_session: AsyncSession, notification_queue: NotificationQueue
) -> None:
    service = NotificationService(db_session, notification_queue)
    future = datetime.now(timezone.utc) + timedelta(hours=2)

    notification = await service.schedule(
        ScheduleNotificationRequest(
            source="core-service",
            source_reference_id=str(uuid.uuid4()),
            user_id=uuid.uuid4(),
            scheduled_for=future,
            message="Reminder message",
        )
    )

    assert notification.status == NotificationStatus.PENDING
    dequeued = await notification_queue.dequeue(timeout_seconds=0.2)
    assert dequeued is None  # not due yet, shouldn't be queued


async def test_schedule_immediately_queues_past_due_time(
    db_session: AsyncSession, notification_queue: NotificationQueue
) -> None:
    service = NotificationService(db_session, notification_queue)
    past = datetime.now(timezone.utc) - timedelta(minutes=5)

    notification = await service.schedule(
        ScheduleNotificationRequest(
            source="core-service",
            source_reference_id=str(uuid.uuid4()),
            user_id=uuid.uuid4(),
            scheduled_for=past,
            message="Overdue reminder",
        )
    )

    assert notification.status == NotificationStatus.QUEUED
    dequeued = await notification_queue.dequeue(timeout_seconds=1)
    assert dequeued == notification.id


async def test_schedule_upserts_by_source_and_reference_id(
    db_session: AsyncSession, notification_queue: NotificationQueue
) -> None:
    service = NotificationService(db_session, notification_queue)
    reference_id = str(uuid.uuid4())
    user_id = uuid.uuid4()
    first_time = datetime.now(timezone.utc) + timedelta(hours=1)
    second_time = datetime.now(timezone.utc) + timedelta(hours=3)

    first = await service.schedule(
        ScheduleNotificationRequest(
            source="core-service",
            source_reference_id=reference_id,
            user_id=user_id,
            scheduled_for=first_time,
            message="First message",
        )
    )
    second = await service.schedule(
        ScheduleNotificationRequest(
            source="core-service",
            source_reference_id=reference_id,
            user_id=user_id,
            scheduled_for=second_time,
            message="Updated message",
        )
    )

    assert first.id == second.id
    assert second.message == "Updated message"


async def test_cancel_marks_notification_cancelled(
    db_session: AsyncSession, notification_queue: NotificationQueue
) -> None:
    service = NotificationService(db_session, notification_queue)
    reference_id = str(uuid.uuid4())
    await service.schedule(
        ScheduleNotificationRequest(
            source="core-service",
            source_reference_id=reference_id,
            user_id=uuid.uuid4(),
            scheduled_for=datetime.now(timezone.utc) + timedelta(hours=1),
            message="To be cancelled",
        )
    )

    cancelled = await service.cancel("core-service", reference_id)
    assert cancelled.status == NotificationStatus.CANCELLED


async def test_cancel_nonexistent_raises_not_found(
    db_session: AsyncSession, notification_queue: NotificationQueue
) -> None:
    from app.core.exceptions import NotFoundError

    service = NotificationService(db_session, notification_queue)
    with pytest.raises(NotFoundError):
        await service.cancel("core-service", "does-not-exist")


async def test_list_for_user_only_returns_own_notifications(
    db_session: AsyncSession, notification_queue: NotificationQueue
) -> None:
    service = NotificationService(db_session, notification_queue)
    owner_id = uuid.uuid4()
    await service.schedule(
        ScheduleNotificationRequest(
            source="core-service",
            source_reference_id=str(uuid.uuid4()),
            user_id=owner_id,
            scheduled_for=datetime.now(timezone.utc) + timedelta(hours=1),
            message="Owner's reminder",
        )
    )
    await service.schedule(
        ScheduleNotificationRequest(
            source="core-service",
            source_reference_id=str(uuid.uuid4()),
            user_id=uuid.uuid4(),
            scheduled_for=datetime.now(timezone.utc) + timedelta(hours=1),
            message="Someone else's reminder",
        )
    )

    items, total = await service.list_for_user(owner_id, offset=0, limit=10)
    assert total == 1
    assert items[0].message == "Owner's reminder"
TODOTAK_EOF

echo '==> Writing notification-service/tests/test_notifications_api.py'
cat > "notification-service/tests/test_notifications_api.py" << 'TODOTAK_EOF'
"""Integration tests for the notification API.

Requires TEST_DATABASE_URL (see conftest.py).
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


def _schedule_payload(**overrides) -> dict:
    payload = {
        "source": "core-service",
        "source_reference_id": str(uuid.uuid4()),
        "user_id": str(uuid.uuid4()),
        "scheduled_for": (
            datetime.now(timezone.utc) + timedelta(hours=1)
        ).isoformat(),
        "message": "Test reminder",
    }
    payload.update(overrides)
    return payload


async def test_schedule_requires_internal_api_key(app_client: AsyncClient) -> None:
    response = await app_client.post(
        "/api/v1/notifications/schedule", json=_schedule_payload()
    )
    assert response.status_code == 401


async def test_schedule_rejects_wrong_internal_api_key(
    app_client: AsyncClient,
) -> None:
    response = await app_client.post(
        "/api/v1/notifications/schedule",
        json=_schedule_payload(),
        headers={"X-Internal-Api-Key": "wrong-key"},
    )
    assert response.status_code == 401


async def test_schedule_succeeds_with_valid_internal_api_key(
    app_client: AsyncClient, internal_headers: dict
) -> None:
    response = await app_client.post(
        "/api/v1/notifications/schedule",
        json=_schedule_payload(),
        headers=internal_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert body["message"] == "Test reminder"


async def test_cancel_requires_internal_api_key(app_client: AsyncClient) -> None:
    response = await app_client.post(
        "/api/v1/notifications/source/core-service/some-id/cancel"
    )
    assert response.status_code == 401


async def test_cancel_with_valid_key_and_existing_notification(
    app_client: AsyncClient, internal_headers: dict
) -> None:
    reference_id = str(uuid.uuid4())
    await app_client.post(
        "/api/v1/notifications/schedule",
        json=_schedule_payload(source_reference_id=reference_id),
        headers=internal_headers,
    )

    response = await app_client.post(
        f"/api/v1/notifications/source/core-service/{reference_id}/cancel",
        headers=internal_headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


async def test_list_notifications_requires_user_auth(
    app_client: AsyncClient,
) -> None:
    response = await app_client.get("/api/v1/notifications")
    assert response.status_code == 401


async def test_list_notifications_returns_only_own(
    app_client: AsyncClient,
    internal_headers: dict,
    auth_headers: dict,
    test_user_id: uuid.UUID,
) -> None:
    await app_client.post(
        "/api/v1/notifications/schedule",
        json=_schedule_payload(user_id=str(test_user_id)),
        headers=internal_headers,
    )
    await app_client.post(
        "/api/v1/notifications/schedule",
        json=_schedule_payload(user_id=str(uuid.uuid4())),
        headers=internal_headers,
    )

    response = await app_client.get(
        "/api/v1/notifications", headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1


async def test_get_notification_not_found(
    app_client: AsyncClient, auth_headers: dict
) -> None:
    response = await app_client.get(
        f"/api/v1/notifications/{uuid.uuid4()}", headers=auth_headers
    )
    assert response.status_code == 404


async def test_preferences_default_to_email_enabled(
    app_client: AsyncClient, auth_headers: dict
) -> None:
    response = await app_client.get(
        "/api/v1/notifications/preferences", headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["email_enabled"] is True


async def test_update_preferences(
    app_client: AsyncClient, auth_headers: dict
) -> None:
    response = await app_client.patch(
        "/api/v1/notifications/preferences",
        json={"email_enabled": False},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["email_enabled"] is False

    follow_up = await app_client.get(
        "/api/v1/notifications/preferences", headers=auth_headers
    )
    assert follow_up.json()["email_enabled"] is False
TODOTAK_EOF

echo '==> Writing notification-service/tests/test_redis_queue.py'
cat > "notification-service/tests/test_redis_queue.py" << 'TODOTAK_EOF'
"""Unit tests for NotificationQueue using fakeredis.

No real Redis, database, or network access required.
"""
import os
import uuid

import pytest
import pytest_asyncio
from fakeredis import FakeAsyncRedis

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-unit-tests-only")
os.environ.setdefault("INTERNAL_SERVICE_API_KEY", "test-internal-key")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/unused"
)

from app.queue.redis_queue import NotificationQueue  # noqa: E402

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def queue():
    redis_client = FakeAsyncRedis()
    q = NotificationQueue(redis_client, "test:queue")
    yield q
    await redis_client.aclose()


async def test_enqueue_then_dequeue_returns_same_id(queue: NotificationQueue) -> None:
    notification_id = uuid.uuid4()
    await queue.enqueue(notification_id)

    result = await queue.dequeue(timeout_seconds=1)
    assert result == notification_id


async def test_dequeue_times_out_on_empty_queue(queue: NotificationQueue) -> None:
    result = await queue.dequeue(timeout_seconds=0.2)
    assert result is None


async def test_enqueue_many_preserves_all_ids(queue: NotificationQueue) -> None:
    ids = [uuid.uuid4() for _ in range(3)]
    await queue.enqueue_many(ids)

    dequeued = set()
    for _ in range(3):
        result = await queue.dequeue(timeout_seconds=1)
        assert result is not None
        dequeued.add(result)

    assert dequeued == set(ids)


async def test_enqueue_many_with_empty_list_is_a_noop(
    queue: NotificationQueue,
) -> None:
    await queue.enqueue_many([])
    result = await queue.dequeue(timeout_seconds=0.2)
    assert result is None


async def test_queue_is_fifo_by_insertion_order(queue: NotificationQueue) -> None:
    first, second = uuid.uuid4(), uuid.uuid4()
    await queue.enqueue(first)
    await queue.enqueue(second)

    assert await queue.dequeue(timeout_seconds=1) == first
    assert await queue.dequeue(timeout_seconds=1) == second
TODOTAK_EOF

echo '==> Writing notification-service/tests/test_scheduler_worker.py'
cat > "notification-service/tests/test_scheduler_worker.py" << 'TODOTAK_EOF'
"""Integration tests for the scheduler worker.

Requires TEST_DATABASE_URL (see conftest.py).
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import NotificationStatus
from app.queue.redis_queue import NotificationQueue
from app.repositories.notification_repository import NotificationRepository
from app.workers.scheduler_worker import run_scheduler_once

pytestmark = pytest.mark.asyncio


async def test_claims_only_due_pending_notifications(
    db_session: AsyncSession, notification_queue: NotificationQueue
) -> None:
    repository = NotificationRepository(db_session)
    due = await repository.upsert(
        source="core-service",
        source_reference_id=str(uuid.uuid4()),
        user_id=uuid.uuid4(),
        scheduled_for=datetime.now(timezone.utc) - timedelta(minutes=1),
        message="Due now",
    )
    not_due = await repository.upsert(
        source="core-service",
        source_reference_id=str(uuid.uuid4()),
        user_id=uuid.uuid4(),
        scheduled_for=datetime.now(timezone.utc) + timedelta(hours=1),
        message="Not due yet",
    )
    await db_session.commit()

    claimed_count = await run_scheduler_once(db_session, notification_queue)
    assert claimed_count == 1

    await db_session.refresh(due)
    await db_session.refresh(not_due)
    assert due.status == NotificationStatus.QUEUED
    assert not_due.status == NotificationStatus.PENDING

    dequeued = await notification_queue.dequeue(timeout_seconds=1)
    assert dequeued == due.id


async def test_does_not_reclaim_already_queued_notifications(
    db_session: AsyncSession, notification_queue: NotificationQueue
) -> None:
    repository = NotificationRepository(db_session)
    await repository.upsert(
        source="core-service",
        source_reference_id=str(uuid.uuid4()),
        user_id=uuid.uuid4(),
        scheduled_for=datetime.now(timezone.utc) - timedelta(minutes=1),
        message="Due now",
    )
    await db_session.commit()

    first_batch = await run_scheduler_once(db_session, notification_queue)
    second_batch = await run_scheduler_once(db_session, notification_queue)

    assert first_batch == 1
    assert second_batch == 0


async def test_ignores_cancelled_notifications(
    db_session: AsyncSession, notification_queue: NotificationQueue
) -> None:
    repository = NotificationRepository(db_session)
    reference_id = str(uuid.uuid4())
    await repository.upsert(
        source="core-service",
        source_reference_id=reference_id,
        user_id=uuid.uuid4(),
        scheduled_for=datetime.now(timezone.utc) - timedelta(minutes=1),
        message="Will be cancelled",
    )
    await db_session.commit()
    await repository.cancel_by_source("core-service", reference_id)
    await db_session.commit()

    claimed_count = await run_scheduler_once(db_session, notification_queue)
    assert claimed_count == 0
TODOTAK_EOF

echo '==> notification-service files written successfully'
echo 'IMPORTANT: this service depends on two small updates to'
echo 'auth-service and core-service. Run patch_for_notifications.sh too.'
echo ''
echo 'Next steps:'
echo '  1. cp notification-service/.env.example notification-service/.env'
echo '     (JWT_SECRET_KEY must match auth-service; set a real INTERNAL_SERVICE_API_KEY'
echo '      and use the SAME value in auth-service/.env and core-service/.env)'
echo '  2. cd notification-service && pip install -r requirements.txt'
echo '  3. alembic upgrade head'
echo '  4. pytest tests/test_redis_queue.py tests/test_email_templates.py tests/test_auth_service_client.py tests/test_email_client.py'
echo '     (these run standalone; the rest need TEST_DATABASE_URL)'
echo '  5. API:    uvicorn app.main:app --reload'
echo '     Worker: python -m app.workers.run'