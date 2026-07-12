#!/usr/bin/env bash
# Todotak - core-service full implementation
# Run this from the root of your todotak/ repo:
#   bash setup_core_service.sh
set -euo pipefail

echo '==> Creating core-service directories'
mkdir -p "core-service"
mkdir -p "core-service/alembic"
mkdir -p "core-service/alembic/versions"
mkdir -p "core-service/app"
mkdir -p "core-service/app/api"
mkdir -p "core-service/app/api/v1"
mkdir -p "core-service/app/clients"
mkdir -p "core-service/app/core"
mkdir -p "core-service/app/db"
mkdir -p "core-service/app/middleware"
mkdir -p "core-service/app/models"
mkdir -p "core-service/app/repositories"
mkdir -p "core-service/app/schemas"
mkdir -p "core-service/app/services"
mkdir -p "core-service/tests"

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

CORS_ORIGINS=["http://localhost:3000"]

DEFAULT_PAGE_SIZE=20
MAX_PAGE_SIZE=100
TODOTAK_EOF

echo '==> Writing core-service/Dockerfile'
cat > "core-service/Dockerfile" << 'TODOTAK_EOF'
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

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
TODOTAK_EOF

echo '==> Writing core-service/alembic.ini'
cat > "core-service/alembic.ini" << 'TODOTAK_EOF'
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

echo '==> Writing core-service/alembic/env.py'
cat > "core-service/alembic/env.py" << 'TODOTAK_EOF'
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
    Meeting,
    MeetingParticipant,
    Reminder,
    Task,
    TaskTag,
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
        version_table_schema="core",
        include_schemas=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table_schema="core",
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

echo '==> Writing core-service/alembic/script.py.mako'
cat > "core-service/alembic/script.py.mako" << 'TODOTAK_EOF'
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

echo '==> Writing core-service/alembic/versions/0001_initial_core_schema.py'
cat > "core-service/alembic/versions/0001_initial_core_schema.py" << 'TODOTAK_EOF'
"""initial core schema

Revision ID: 0001
Revises:
Create Date: 2026-07-12 00:00:00.000000
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


task_status_enum = postgresql.ENUM(
    "pending",
    "in_progress",
    "completed",
    "cancelled",
    name="task_status",
    schema="core",
)
task_priority_enum = postgresql.ENUM(
    "low", "medium", "high", "urgent", name="task_priority", schema="core"
)
meeting_status_enum = postgresql.ENUM(
    "scheduled", "cancelled", "completed", name="meeting_status", schema="core"
)
participant_response_status_enum = postgresql.ENUM(
    "pending",
    "accepted",
    "declined",
    "tentative",
    name="participant_response_status",
    schema="core",
)


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS core")

    bind = op.get_bind()
    task_status_enum.create(bind, checkfirst=True)
    task_priority_enum.create(bind, checkfirst=True)
    meeting_status_enum.create(bind, checkfirst=True)
    participant_response_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            task_status_enum,
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "priority",
            task_priority_enum,
            nullable=False,
            server_default="medium",
        ),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
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
        schema="core",
    )
    op.create_index("ix_core_tasks_user_id", "tasks", ["user_id"], schema="core")
    op.create_index("ix_core_tasks_status", "tasks", ["status"], schema="core")
    op.create_index(
        "ix_core_tasks_due_date", "tasks", ["due_date"], schema="core"
    )

    op.create_table(
        "task_tags",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("core.tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        schema="core",
    )
    op.create_index(
        "ix_core_task_tags_task_id", "task_tags", ["task_id"], schema="core"
    )

    op.create_table(
        "meetings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            meeting_status_enum,
            nullable=False,
            server_default="scheduled",
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
        schema="core",
    )
    op.create_index(
        "ix_core_meetings_user_id", "meetings", ["user_id"], schema="core"
    )
    op.create_index(
        "ix_core_meetings_start_time", "meetings", ["start_time"], schema="core"
    )
    op.create_index(
        "ix_core_meetings_status", "meetings", ["status"], schema="core"
    )

    op.create_table(
        "meeting_participants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "meeting_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("core.meetings.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column(
            "response_status",
            participant_response_status_enum,
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        schema="core",
    )
    op.create_index(
        "ix_core_meeting_participants_meeting_id",
        "meeting_participants",
        ["meeting_id"],
        schema="core",
    )
    op.create_index(
        "ix_core_meeting_participants_user_id",
        "meeting_participants",
        ["user_id"],
        schema="core",
    )

    op.create_table(
        "reminders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("core.tasks.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "meeting_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("core.meetings.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("remind_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("message", sa.String(512), nullable=True),
        sa.Column(
            "is_sent", sa.Boolean(), nullable=False, server_default=sa.false()
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
        schema="core",
    )
    op.create_index(
        "ix_core_reminders_user_id", "reminders", ["user_id"], schema="core"
    )
    op.create_index(
        "ix_core_reminders_task_id", "reminders", ["task_id"], schema="core"
    )
    op.create_index(
        "ix_core_reminders_meeting_id",
        "reminders",
        ["meeting_id"],
        schema="core",
    )
    op.create_index(
        "ix_core_reminders_remind_at", "reminders", ["remind_at"], schema="core"
    )
    op.create_index(
        "ix_core_reminders_is_sent", "reminders", ["is_sent"], schema="core"
    )


def downgrade() -> None:
    op.drop_table("reminders", schema="core")
    op.drop_table("meeting_participants", schema="core")
    op.drop_table("meetings", schema="core")
    op.drop_table("task_tags", schema="core")
    op.drop_table("tasks", schema="core")

    bind = op.get_bind()
    participant_response_status_enum.drop(bind, checkfirst=True)
    meeting_status_enum.drop(bind, checkfirst=True)
    task_priority_enum.drop(bind, checkfirst=True)
    task_status_enum.drop(bind, checkfirst=True)

    op.execute("DROP SCHEMA IF EXISTS core CASCADE")
TODOTAK_EOF

echo '==> Writing core-service/app/__init__.py'
cat > "core-service/app/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing core-service/app/api/__init__.py'
cat > "core-service/app/api/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing core-service/app/api/deps.py'
cat > "core-service/app/api/deps.py" << 'TODOTAK_EOF'
"""Shared FastAPI dependencies for the core-service API layer."""
import uuid
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import CoreServiceError
from app.core.security import get_user_id_from_token
from app.db.session import get_db
from app.services.meeting_service import MeetingService
from app.services.reminder_service import ReminderService
from app.services.task_service import TaskService

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        bearer_scheme
    ),
) -> uuid.UUID:
    """Resolve the authenticated user's id from the access token.

    core-service trusts the JWT signature (shared secret with
    auth-service) rather than calling auth-service on every request.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        return get_user_id_from_token(credentials.credentials)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc


async def get_task_service(db: AsyncSession = Depends(get_db)) -> TaskService:
    return TaskService(db)


async def get_meeting_service(
    db: AsyncSession = Depends(get_db),
) -> MeetingService:
    return MeetingService(db)


async def get_reminder_service(
    db: AsyncSession = Depends(get_db),
) -> ReminderService:
    return ReminderService(db)
TODOTAK_EOF

echo '==> Writing core-service/app/api/v1/__init__.py'
cat > "core-service/app/api/v1/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing core-service/app/api/v1/meetings.py'
cat > "core-service/app/api/v1/meetings.py" << 'TODOTAK_EOF'
"""Meeting API routes."""
import math
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user_id, get_meeting_service
from app.core.exceptions import CoreServiceError
from app.models.meeting import MeetingStatus
from app.schemas.common import PageResponse
from app.schemas.meeting import (
    MeetingCreate,
    MeetingResponse,
    MeetingUpdate,
    ParticipantResponseUpdate,
)
from app.services.meeting_service import MeetingService

router = APIRouter(prefix="/meetings", tags=["meetings"])


@router.post(
    "", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED
)
async def create_meeting(
    payload: MeetingCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    meeting_service: MeetingService = Depends(get_meeting_service),
) -> MeetingResponse:
    try:
        meeting = await meeting_service.create_meeting(user_id, payload)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return MeetingResponse.model_validate(meeting)


@router.get("", response_model=PageResponse[MeetingResponse])
async def list_meetings(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: Optional[MeetingStatus] = Query(default=None, alias="status"),
    starts_after: Optional[datetime] = Query(default=None),
    starts_before: Optional[datetime] = Query(default=None),
    user_id: uuid.UUID = Depends(get_current_user_id),
    meeting_service: MeetingService = Depends(get_meeting_service),
) -> PageResponse[MeetingResponse]:
    offset = (page - 1) * page_size
    items, total = await meeting_service.list_meetings(
        user_id,
        offset=offset,
        limit=page_size,
        status=status_filter,
        starts_after=starts_after,
        starts_before=starts_before,
    )
    return PageResponse[MeetingResponse](
        items=[MeetingResponse.model_validate(m) for m in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    meeting_service: MeetingService = Depends(get_meeting_service),
) -> MeetingResponse:
    try:
        meeting = await meeting_service.get_meeting(user_id, meeting_id)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return MeetingResponse.model_validate(meeting)


@router.patch("/{meeting_id}", response_model=MeetingResponse)
async def update_meeting(
    meeting_id: uuid.UUID,
    payload: MeetingUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    meeting_service: MeetingService = Depends(get_meeting_service),
) -> MeetingResponse:
    try:
        meeting = await meeting_service.update_meeting(user_id, meeting_id, payload)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return MeetingResponse.model_validate(meeting)


@router.post("/{meeting_id}/cancel", response_model=MeetingResponse)
async def cancel_meeting(
    meeting_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    meeting_service: MeetingService = Depends(get_meeting_service),
) -> MeetingResponse:
    try:
        meeting = await meeting_service.cancel_meeting(user_id, meeting_id)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return MeetingResponse.model_validate(meeting)


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(
    meeting_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    meeting_service: MeetingService = Depends(get_meeting_service),
) -> None:
    try:
        await meeting_service.delete_meeting(user_id, meeting_id)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc


@router.patch(
    "/{meeting_id}/participants/{participant_id}",
    response_model=MeetingResponse,
)
async def update_participant_response(
    meeting_id: uuid.UUID,
    participant_id: uuid.UUID,
    payload: ParticipantResponseUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    meeting_service: MeetingService = Depends(get_meeting_service),
) -> MeetingResponse:
    try:
        meeting = await meeting_service.update_participant_response(
            user_id, meeting_id, participant_id, payload.response_status
        )
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return MeetingResponse.model_validate(meeting)
TODOTAK_EOF

echo '==> Writing core-service/app/api/v1/reminders.py'
cat > "core-service/app/api/v1/reminders.py" << 'TODOTAK_EOF'
"""Reminder API routes."""
import math
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user_id, get_reminder_service
from app.core.exceptions import CoreServiceError
from app.schemas.common import PageResponse
from app.schemas.reminder import ReminderCreate, ReminderResponse, ReminderUpdate
from app.services.reminder_service import ReminderService

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.post(
    "", response_model=ReminderResponse, status_code=status.HTTP_201_CREATED
)
async def create_reminder(
    payload: ReminderCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    reminder_service: ReminderService = Depends(get_reminder_service),
) -> ReminderResponse:
    try:
        reminder = await reminder_service.create_reminder(user_id, payload)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return ReminderResponse.model_validate(reminder)


@router.get("", response_model=PageResponse[ReminderResponse])
async def list_reminders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    is_sent: Optional[bool] = Query(default=None),
    user_id: uuid.UUID = Depends(get_current_user_id),
    reminder_service: ReminderService = Depends(get_reminder_service),
) -> PageResponse[ReminderResponse]:
    offset = (page - 1) * page_size
    items, total = await reminder_service.list_reminders(
        user_id, offset=offset, limit=page_size, is_sent=is_sent
    )
    return PageResponse[ReminderResponse](
        items=[ReminderResponse.model_validate(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/{reminder_id}", response_model=ReminderResponse)
async def get_reminder(
    reminder_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    reminder_service: ReminderService = Depends(get_reminder_service),
) -> ReminderResponse:
    try:
        reminder = await reminder_service.get_reminder(user_id, reminder_id)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return ReminderResponse.model_validate(reminder)


@router.patch("/{reminder_id}", response_model=ReminderResponse)
async def update_reminder(
    reminder_id: uuid.UUID,
    payload: ReminderUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    reminder_service: ReminderService = Depends(get_reminder_service),
) -> ReminderResponse:
    try:
        reminder = await reminder_service.update_reminder(
            user_id, reminder_id, payload
        )
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return ReminderResponse.model_validate(reminder)


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(
    reminder_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    reminder_service: ReminderService = Depends(get_reminder_service),
) -> None:
    try:
        await reminder_service.delete_reminder(user_id, reminder_id)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
TODOTAK_EOF

echo '==> Writing core-service/app/api/v1/tasks.py'
cat > "core-service/app/api/v1/tasks.py" << 'TODOTAK_EOF'
"""Task API routes."""
import math
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user_id, get_task_service
from app.core.exceptions import CoreServiceError
from app.models.task import TaskPriority, TaskStatus
from app.schemas.common import PageResponse
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    task_service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    try:
        task = await task_service.create_task(user_id, payload)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return TaskResponse.model_validate(task)


@router.get("", response_model=PageResponse[TaskResponse])
async def list_tasks(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: Optional[TaskStatus] = Query(default=None, alias="status"),
    priority: Optional[TaskPriority] = Query(default=None),
    due_before: Optional[datetime] = Query(default=None),
    due_after: Optional[datetime] = Query(default=None),
    tag: Optional[str] = Query(default=None),
    user_id: uuid.UUID = Depends(get_current_user_id),
    task_service: TaskService = Depends(get_task_service),
) -> PageResponse[TaskResponse]:
    offset = (page - 1) * page_size
    items, total = await task_service.list_tasks(
        user_id,
        offset=offset,
        limit=page_size,
        status=status_filter,
        priority=priority,
        due_before=due_before,
        due_after=due_after,
        tag=tag,
    )
    return PageResponse[TaskResponse](
        items=[TaskResponse.model_validate(t) for t in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    task_service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    try:
        task = await task_service.get_task(user_id, task_id)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return TaskResponse.model_validate(task)


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    task_service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    try:
        task = await task_service.update_task(user_id, task_id, payload)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return TaskResponse.model_validate(task)


@router.put("/{task_id}/tags", response_model=TaskResponse)
async def replace_task_tags(
    task_id: uuid.UUID,
    tags: List[str],
    user_id: uuid.UUID = Depends(get_current_user_id),
    task_service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    try:
        task = await task_service.replace_tags(user_id, task_id, tags)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return TaskResponse.model_validate(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    task_service: TaskService = Depends(get_task_service),
) -> None:
    try:
        await task_service.delete_task(user_id, task_id)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
TODOTAK_EOF

echo '==> Writing core-service/app/clients/__init__.py'
cat > "core-service/app/clients/__init__.py" << 'TODOTAK_EOF'

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
                    "/api/v1/notifications/schedule", json=payload
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
                    f"/api/v1/notifications/source/core-service/{reminder_id}/cancel"
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

echo '==> Writing core-service/app/core/__init__.py'
cat > "core-service/app/core/__init__.py" << 'TODOTAK_EOF'

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

    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
TODOTAK_EOF

echo '==> Writing core-service/app/core/exceptions.py'
cat > "core-service/app/core/exceptions.py" << 'TODOTAK_EOF'
"""Domain-level exceptions for the core-service.

Translated into HTTP responses by the handlers registered in
app.middleware.exception_handler.
"""


class CoreServiceError(Exception):
    """Base class for all core-service domain errors."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class InvalidTokenError(CoreServiceError):
    """Raised when an access token is missing, invalid, or expired."""

    def __init__(self, message: str = "Invalid or expired token") -> None:
        super().__init__(message, status_code=401)


class NotFoundError(CoreServiceError):
    """Raised when a requested resource does not exist."""

    def __init__(self, resource: str = "Resource") -> None:
        super().__init__(f"{resource} not found", status_code=404)


class ForbiddenError(CoreServiceError):
    """Raised when a user attempts to access a resource they don't own."""

    def __init__(self, message: str = "You do not have access to this resource") -> None:
        super().__init__(message, status_code=403)


class ValidationError(CoreServiceError):
    """Raised for business-rule validation failures (e.g. bad date ranges)."""

    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)
TODOTAK_EOF

echo '==> Writing core-service/app/core/security.py'
cat > "core-service/app/core/security.py" << 'TODOTAK_EOF'
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
TODOTAK_EOF

echo '==> Writing core-service/app/db/__init__.py'
cat > "core-service/app/db/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing core-service/app/db/base.py'
cat > "core-service/app/db/base.py" << 'TODOTAK_EOF'
"""Declarative base class shared by all core-service ORM models."""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models in this service."""
TODOTAK_EOF

echo '==> Writing core-service/app/db/session.py'
cat > "core-service/app/db/session.py" << 'TODOTAK_EOF'
"""Async SQLAlchemy engine and session factory for core-service."""
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

echo '==> Writing core-service/app/main.py'
cat > "core-service/app/main.py" << 'TODOTAK_EOF'
"""Core-service FastAPI application entrypoint."""
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.meetings import router as meetings_router
from app.api.v1.reminders import router as reminders_router
from app.api.v1.tasks import router as tasks_router
from app.core.config import get_settings
from app.middleware.exception_handler import register_exception_handlers

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application startup/shutdown hooks."""
    yield


def create_app() -> FastAPI:
    """Application factory for the core-service."""
    app = FastAPI(
        title="Todotak Core Service",
        description="Manages tasks, meetings, and reminders.",
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
    app.include_router(tasks_router, prefix="/api/v1")
    app.include_router(meetings_router, prefix="/api/v1")
    app.include_router(reminders_router, prefix="/api/v1")

    @app.get("/health", tags=["health"])
    async def health_check() -> dict[str, str]:
        return {"status": "ok", "service": settings.SERVICE_NAME}

    return app


app = create_app()
TODOTAK_EOF

echo '==> Writing core-service/app/middleware/__init__.py'
cat > "core-service/app/middleware/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing core-service/app/middleware/exception_handler.py'
cat > "core-service/app/middleware/exception_handler.py" << 'TODOTAK_EOF'
"""Global exception handlers for the core-service FastAPI app."""
import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.exceptions import CoreServiceError

logger = logging.getLogger("core-service")


def register_exception_handlers(app: FastAPI) -> None:
    """Attach domain, validation, and catch-all exception handlers."""

    @app.exception_handler(CoreServiceError)
    async def core_service_error_handler(
        request: Request, exc: CoreServiceError
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
        logger.exception("Unhandled exception in core-service", exc_info=exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )
TODOTAK_EOF

echo '==> Writing core-service/app/models/__init__.py'
cat > "core-service/app/models/__init__.py" << 'TODOTAK_EOF'
"""ORM models package.

Every model is imported here so that Base.metadata is fully populated
when Alembic (or anything else) imports app.models.
"""
from app.models.meeting import Meeting, MeetingParticipant
from app.models.reminder import Reminder
from app.models.task import Task, TaskTag

__all__ = [
    "Task",
    "TaskTag",
    "Meeting",
    "MeetingParticipant",
    "Reminder",
]
TODOTAK_EOF

echo '==> Writing core-service/app/models/meeting.py'
cat > "core-service/app/models/meeting.py" << 'TODOTAK_EOF'
"""Meeting and MeetingParticipant ORM models for the core schema."""
import enum
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MeetingStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class ParticipantResponseStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    TENTATIVE = "tentative"


class Meeting(Base):
    """A scheduled meeting owned by a user."""

    __tablename__ = "meetings"
    __table_args__ = {"schema": "core"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    end_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    status: Mapped[MeetingStatus] = mapped_column(
        SAEnum(MeetingStatus, name="meeting_status", schema="core"),
        default=MeetingStatus.SCHEDULED,
        nullable=False,
        index=True,
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

    participants: Mapped[List["MeetingParticipant"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Meeting id={self.id} title={self.title!r} status={self.status}>"


class MeetingParticipant(Base):
    """A participant invited to a meeting, internal or external."""

    __tablename__ = "meeting_participants"
    __table_args__ = {"schema": "core"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    meeting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core.meetings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    response_status: Mapped[ParticipantResponseStatus] = mapped_column(
        SAEnum(
            ParticipantResponseStatus,
            name="participant_response_status",
            schema="core",
        ),
        default=ParticipantResponseStatus.PENDING,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )

    meeting: Mapped["Meeting"] = relationship(back_populates="participants")

    def __repr__(self) -> str:
        return (
            f"<MeetingParticipant id={self.id} meeting_id={self.meeting_id} "
            f"email={self.email!r}>"
        )
TODOTAK_EOF

echo '==> Writing core-service/app/models/reminder.py'
cat > "core-service/app/models/reminder.py" << 'TODOTAK_EOF'
"""Reminder ORM model for the core schema."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Reminder(Base):
    """A scheduled reminder, optionally tied to a task or meeting.

    A reminder may stand alone (both task_id and meeting_id null), or
    be attached to exactly one of a task or a meeting. That invariant
    is enforced in ReminderService rather than at the DB level, since
    it is a business rule rather than a structural constraint.
    """

    __tablename__ = "reminders"
    __table_args__ = {"schema": "core"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    task_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core.tasks.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    meeting_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core.meetings.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    remind_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    message: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    is_sent: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
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
        return f"<Reminder id={self.id} remind_at={self.remind_at} is_sent={self.is_sent}>"
TODOTAK_EOF

echo '==> Writing core-service/app/models/task.py'
cat > "core-service/app/models/task.py" << 'TODOTAK_EOF'
"""Task and TaskTag ORM models for the core schema."""
import enum
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TaskPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Task(Base):
    """A user-owned to-do item."""

    __tablename__ = "tasks"
    __table_args__ = {"schema": "core"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(
        SAEnum(TaskStatus, name="task_status", schema="core"),
        default=TaskStatus.PENDING,
        nullable=False,
        index=True,
    )
    priority: Mapped[TaskPriority] = mapped_column(
        SAEnum(TaskPriority, name="task_priority", schema="core"),
        default=TaskPriority.MEDIUM,
        nullable=False,
    )
    due_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
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

    tags: Mapped[List["TaskTag"]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Task id={self.id} title={self.title!r} status={self.status}>"


class TaskTag(Base):
    """A free-text label attached to a task."""

    __tablename__ = "task_tags"
    __table_args__ = {"schema": "core"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core.tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )

    task: Mapped["Task"] = relationship(back_populates="tags")

    def __repr__(self) -> str:
        return f"<TaskTag id={self.id} task_id={self.task_id} name={self.name!r}>"
TODOTAK_EOF

echo '==> Writing core-service/app/repositories/__init__.py'
cat > "core-service/app/repositories/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing core-service/app/repositories/meeting_repository.py'
cat > "core-service/app/repositories/meeting_repository.py" << 'TODOTAK_EOF'
"""Data access layer for the Meeting and MeetingParticipant models."""
import uuid
from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.meeting import (
    Meeting,
    MeetingParticipant,
    MeetingStatus,
    ParticipantResponseStatus,
)


class MeetingRepository:
    """Encapsulates all database access for Meeting rows."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(
        self, meeting_id: uuid.UUID, *, with_participants: bool = True
    ) -> Optional[Meeting]:
        stmt = select(Meeting).where(Meeting.id == meeting_id)
        if with_participants:
            stmt = stmt.options(selectinload(Meeting.participants))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        *,
        offset: int,
        limit: int,
        status: Optional[MeetingStatus] = None,
        starts_after: Optional[datetime] = None,
        starts_before: Optional[datetime] = None,
    ) -> Tuple[List[Meeting], int]:
        stmt = select(Meeting).where(Meeting.user_id == user_id)

        if status is not None:
            stmt = stmt.where(Meeting.status == status)
        if starts_after is not None:
            stmt = stmt.where(Meeting.start_time >= starts_after)
        if starts_before is not None:
            stmt = stmt.where(Meeting.start_time <= starts_before)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = (
            stmt.options(selectinload(Meeting.participants))
            .order_by(Meeting.start_time.asc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        items = list(result.unique().scalars().all())
        return items, total

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        title: str,
        description: Optional[str],
        location: Optional[str],
        start_time: datetime,
        end_time: datetime,
        participants: List[Tuple[str, Optional[str]]],
    ) -> Meeting:
        meeting = Meeting(
            user_id=user_id,
            title=title,
            description=description,
            location=location,
            start_time=start_time,
            end_time=end_time,
        )
        meeting.participants = [
            MeetingParticipant(email=email, name=name)
            for email, name in participants
        ]
        self.db.add(meeting)
        await self.db.flush()
        await self.db.refresh(meeting, attribute_names=["participants"])
        return meeting

    async def update(
        self,
        meeting: Meeting,
        *,
        title: Optional[str] = None,
        description: Optional[str] = None,
        location: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        status: Optional[MeetingStatus] = None,
    ) -> Meeting:
        if title is not None:
            meeting.title = title
        if description is not None:
            meeting.description = description
        if location is not None:
            meeting.location = location
        if start_time is not None:
            meeting.start_time = start_time
        if end_time is not None:
            meeting.end_time = end_time
        if status is not None:
            meeting.status = status
        await self.db.flush()
        await self.db.refresh(meeting, attribute_names=["participants"])
        return meeting

    async def delete(self, meeting: Meeting) -> None:
        await self.db.delete(meeting)
        await self.db.flush()

    async def get_participant(
        self, meeting_id: uuid.UUID, participant_id: uuid.UUID
    ) -> Optional[MeetingParticipant]:
        result = await self.db.execute(
            select(MeetingParticipant).where(
                MeetingParticipant.id == participant_id,
                MeetingParticipant.meeting_id == meeting_id,
            )
        )
        return result.scalar_one_or_none()

    async def update_participant_response(
        self,
        participant: MeetingParticipant,
        response_status: ParticipantResponseStatus,
    ) -> MeetingParticipant:
        participant.response_status = response_status
        await self.db.flush()
        await self.db.refresh(participant)
        return participant
TODOTAK_EOF

echo '==> Writing core-service/app/repositories/reminder_repository.py'
cat > "core-service/app/repositories/reminder_repository.py" << 'TODOTAK_EOF'
"""Data access layer for the Reminder model."""
import uuid
from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reminder import Reminder


class ReminderRepository:
    """Encapsulates all database access for Reminder rows."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, reminder_id: uuid.UUID) -> Optional[Reminder]:
        result = await self.db.execute(
            select(Reminder).where(Reminder.id == reminder_id)
        )
        return result.scalar_one_or_none()

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        *,
        offset: int,
        limit: int,
        is_sent: Optional[bool] = None,
    ) -> Tuple[List[Reminder], int]:
        stmt = select(Reminder).where(Reminder.user_id == user_id)
        if is_sent is not None:
            stmt = stmt.where(Reminder.is_sent == is_sent)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = stmt.order_by(Reminder.remind_at.asc()).offset(offset).limit(limit)
        result = await self.db.execute(stmt)
        items = list(result.scalars().all())
        return items, total

    async def list_due(self, *, before: datetime, limit: int = 500) -> List[Reminder]:
        """Return unsent reminders whose remind_at has passed.

        Used by a scheduled worker (or notification-service poller) to
        find reminders that need to be dispatched.
        """
        stmt = (
            select(Reminder)
            .where(Reminder.is_sent.is_(False), Reminder.remind_at <= before)
            .order_by(Reminder.remind_at.asc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        remind_at: datetime,
        message: Optional[str],
        task_id: Optional[uuid.UUID],
        meeting_id: Optional[uuid.UUID],
    ) -> Reminder:
        reminder = Reminder(
            user_id=user_id,
            remind_at=remind_at,
            message=message,
            task_id=task_id,
            meeting_id=meeting_id,
        )
        self.db.add(reminder)
        await self.db.flush()
        await self.db.refresh(reminder)
        return reminder

    async def update(
        self,
        reminder: Reminder,
        *,
        remind_at: Optional[datetime] = None,
        message: Optional[str] = None,
    ) -> Reminder:
        if remind_at is not None:
            reminder.remind_at = remind_at
        if message is not None:
            reminder.message = message
        await self.db.flush()
        await self.db.refresh(reminder)
        return reminder

    async def mark_sent(self, reminder: Reminder) -> Reminder:
        reminder.is_sent = True
        await self.db.flush()
        await self.db.refresh(reminder)
        return reminder

    async def delete(self, reminder: Reminder) -> None:
        await self.db.delete(reminder)
        await self.db.flush()
TODOTAK_EOF

echo '==> Writing core-service/app/repositories/task_repository.py'
cat > "core-service/app/repositories/task_repository.py" << 'TODOTAK_EOF'
"""Data access layer for the Task and TaskTag models."""
import uuid
from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.task import Task, TaskPriority, TaskStatus, TaskTag


class TaskRepository:
    """Encapsulates all database access for Task rows."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(
        self, task_id: uuid.UUID, *, with_tags: bool = True
    ) -> Optional[Task]:
        stmt = select(Task).where(Task.id == task_id)
        if with_tags:
            stmt = stmt.options(selectinload(Task.tags))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        *,
        offset: int,
        limit: int,
        status: Optional[TaskStatus] = None,
        priority: Optional[TaskPriority] = None,
        due_before: Optional[datetime] = None,
        due_after: Optional[datetime] = None,
        tag: Optional[str] = None,
    ) -> Tuple[List[Task], int]:
        stmt = select(Task).where(Task.user_id == user_id)

        if status is not None:
            stmt = stmt.where(Task.status == status)
        if priority is not None:
            stmt = stmt.where(Task.priority == priority)
        if due_before is not None:
            stmt = stmt.where(Task.due_date <= due_before)
        if due_after is not None:
            stmt = stmt.where(Task.due_date >= due_after)
        if tag is not None:
            stmt = stmt.join(Task.tags).where(
                TaskTag.name == tag.strip().lower()
            ).distinct()

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = (
            stmt.options(selectinload(Task.tags))
            .order_by(Task.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        items = list(result.unique().scalars().all())
        return items, total

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        title: str,
        description: Optional[str],
        priority: TaskPriority,
        due_date: Optional[datetime],
        tags: List[str],
    ) -> Task:
        task = Task(
            user_id=user_id,
            title=title,
            description=description,
            priority=priority,
            due_date=due_date,
        )
        task.tags = [TaskTag(name=name) for name in tags]
        self.db.add(task)
        await self.db.flush()
        await self.db.refresh(task, attribute_names=["tags"])
        return task

    async def update(
        self,
        task: Task,
        *,
        title: Optional[str] = None,
        description: Optional[str] = None,
        status: Optional[TaskStatus] = None,
        priority: Optional[TaskPriority] = None,
        due_date: Optional[datetime] = None,
        completed_at: Optional[datetime] = None,
        clear_completed_at: bool = False,
    ) -> Task:
        if title is not None:
            task.title = title
        if description is not None:
            task.description = description
        if status is not None:
            task.status = status
        if priority is not None:
            task.priority = priority
        if due_date is not None:
            task.due_date = due_date
        if clear_completed_at:
            task.completed_at = None
        elif completed_at is not None:
            task.completed_at = completed_at
        await self.db.flush()
        await self.db.refresh(task, attribute_names=["tags"])
        return task

    async def delete(self, task: Task) -> None:
        await self.db.delete(task)
        await self.db.flush()

    async def replace_tags(self, task: Task, tags: List[str]) -> Task:
        task.tags = [TaskTag(name=name) for name in tags]
        await self.db.flush()
        await self.db.refresh(task, attribute_names=["tags"])
        return task
TODOTAK_EOF

echo '==> Writing core-service/app/schemas/__init__.py'
cat > "core-service/app/schemas/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing core-service/app/schemas/common.py'
cat > "core-service/app/schemas/common.py" << 'TODOTAK_EOF'
"""Shared pagination request/response schemas."""
from typing import Generic, List, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PageParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class PageResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int
TODOTAK_EOF

echo '==> Writing core-service/app/schemas/meeting.py'
cat > "core-service/app/schemas/meeting.py" << 'TODOTAK_EOF'
"""Pydantic schemas for meeting resources."""
import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.models.meeting import MeetingStatus, ParticipantResponseStatus


class ParticipantCreate(BaseModel):
    email: EmailStr
    name: Optional[str] = Field(default=None, max_length=255)


class ParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    name: Optional[str]
    response_status: ParticipantResponseStatus


class MeetingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=10_000)
    location: Optional[str] = Field(default=None, max_length=255)
    start_time: datetime
    end_time: datetime
    participants: List[ParticipantCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_time_range(self) -> "MeetingCreate":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class MeetingUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=10_000)
    location: Optional[str] = Field(default=None, max_length=255)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[MeetingStatus] = None

    @model_validator(mode="after")
    def _validate_time_range(self) -> "MeetingUpdate":
        if (
            self.start_time is not None
            and self.end_time is not None
            and self.end_time <= self.start_time
        ):
            raise ValueError("end_time must be after start_time")
        return self


class MeetingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: Optional[str]
    location: Optional[str]
    start_time: datetime
    end_time: datetime
    status: MeetingStatus
    created_at: datetime
    updated_at: datetime
    participants: List[ParticipantResponse] = Field(default_factory=list)


class ParticipantResponseUpdate(BaseModel):
    response_status: ParticipantResponseStatus
TODOTAK_EOF

echo '==> Writing core-service/app/schemas/reminder.py'
cat > "core-service/app/schemas/reminder.py" << 'TODOTAK_EOF'
"""Pydantic schemas for reminder resources."""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ReminderCreate(BaseModel):
    remind_at: datetime
    message: Optional[str] = Field(default=None, max_length=512)
    task_id: Optional[uuid.UUID] = None
    meeting_id: Optional[uuid.UUID] = None

    @model_validator(mode="after")
    def _validate_single_link(self) -> "ReminderCreate":
        if self.task_id is not None and self.meeting_id is not None:
            raise ValueError(
                "A reminder can be linked to a task or a meeting, not both"
            )
        return self


class ReminderUpdate(BaseModel):
    remind_at: Optional[datetime] = None
    message: Optional[str] = Field(default=None, max_length=512)


class ReminderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    task_id: Optional[uuid.UUID]
    meeting_id: Optional[uuid.UUID]
    remind_at: datetime
    message: Optional[str]
    is_sent: bool
    created_at: datetime
    updated_at: datetime
TODOTAK_EOF

echo '==> Writing core-service/app/schemas/task.py'
cat > "core-service/app/schemas/task.py" << 'TODOTAK_EOF'
"""Pydantic schemas for task resources."""
import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.task import TaskPriority, TaskStatus


class TaskTagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=10_000)
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: Optional[datetime] = None
    tags: List[str] = Field(default_factory=list)

    @field_validator("tags")
    @classmethod
    def _dedupe_and_validate_tags(cls, tags: List[str]) -> List[str]:
        cleaned = []
        seen = set()
        for tag in tags:
            normalized = tag.strip().lower()
            if not normalized:
                continue
            if len(normalized) > 64:
                raise ValueError("Tag names must be 64 characters or fewer")
            if normalized not in seen:
                seen.add(normalized)
                cleaned.append(normalized)
        return cleaned


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=10_000)
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[datetime] = None


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: Optional[str]
    status: TaskStatus
    priority: TaskPriority
    due_date: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    tags: List[TaskTagResponse] = Field(default_factory=list)


class TaskFilterParams(BaseModel):
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_before: Optional[datetime] = None
    due_after: Optional[datetime] = None
    tag: Optional[str] = None
TODOTAK_EOF

echo '==> Writing core-service/app/services/__init__.py'
cat > "core-service/app/services/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing core-service/app/services/meeting_service.py'
cat > "core-service/app/services/meeting_service.py" << 'TODOTAK_EOF'
"""Business logic for meeting management."""
import uuid
from typing import List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.meeting import (
    Meeting,
    MeetingStatus,
    ParticipantResponseStatus,
)
from app.repositories.meeting_repository import MeetingRepository
from app.schemas.meeting import MeetingCreate, MeetingUpdate


class MeetingService:
    """Orchestrates meeting use cases, enforcing ownership rules."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.meetings = MeetingRepository(db)

    async def create_meeting(
        self, user_id: uuid.UUID, payload: MeetingCreate
    ) -> Meeting:
        participants = [(p.email, p.name) for p in payload.participants]
        meeting = await self.meetings.create(
            user_id=user_id,
            title=payload.title,
            description=payload.description,
            location=payload.location,
            start_time=payload.start_time,
            end_time=payload.end_time,
            participants=participants,
        )
        await self.db.commit()
        return meeting

    async def get_meeting(self, user_id: uuid.UUID, meeting_id: uuid.UUID) -> Meeting:
        meeting = await self.meetings.get_by_id(meeting_id)
        if meeting is None:
            raise NotFoundError("Meeting")
        self._assert_owner(meeting, user_id)
        return meeting

    async def list_meetings(
        self,
        user_id: uuid.UUID,
        *,
        offset: int,
        limit: int,
        status: Optional[MeetingStatus] = None,
        starts_after=None,
        starts_before=None,
    ) -> Tuple[List[Meeting], int]:
        return await self.meetings.list_for_user(
            user_id,
            offset=offset,
            limit=limit,
            status=status,
            starts_after=starts_after,
            starts_before=starts_before,
        )

    async def update_meeting(
        self, user_id: uuid.UUID, meeting_id: uuid.UUID, payload: MeetingUpdate
    ) -> Meeting:
        meeting = await self.get_meeting(user_id, meeting_id)
        updated = await self.meetings.update(
            meeting,
            title=payload.title,
            description=payload.description,
            location=payload.location,
            start_time=payload.start_time,
            end_time=payload.end_time,
            status=payload.status,
        )
        await self.db.commit()
        return updated

    async def cancel_meeting(
        self, user_id: uuid.UUID, meeting_id: uuid.UUID
    ) -> Meeting:
        meeting = await self.get_meeting(user_id, meeting_id)
        updated = await self.meetings.update(meeting, status=MeetingStatus.CANCELLED)
        await self.db.commit()
        return updated

    async def delete_meeting(self, user_id: uuid.UUID, meeting_id: uuid.UUID) -> None:
        meeting = await self.get_meeting(user_id, meeting_id)
        await self.meetings.delete(meeting)
        await self.db.commit()

    async def update_participant_response(
        self,
        user_id: uuid.UUID,
        meeting_id: uuid.UUID,
        participant_id: uuid.UUID,
        response_status: ParticipantResponseStatus,
    ) -> Meeting:
        meeting = await self.get_meeting(user_id, meeting_id)
        participant = await self.meetings.get_participant(meeting_id, participant_id)
        if participant is None:
            raise NotFoundError("Participant")
        await self.meetings.update_participant_response(participant, response_status)
        await self.db.commit()
        return await self.get_meeting(user_id, meeting_id)

    @staticmethod
    def _assert_owner(meeting: Meeting, user_id: uuid.UUID) -> None:
        if meeting.user_id != user_id:
            raise ForbiddenError("You do not have access to this meeting")
TODOTAK_EOF

echo '==> Writing core-service/app/services/reminder_service.py'
cat > "core-service/app/services/reminder_service.py" << 'TODOTAK_EOF'
"""Business logic for reminder management."""
import uuid
from typing import List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.notification_client import NotificationClient
from app.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.models.reminder import Reminder
from app.repositories.meeting_repository import MeetingRepository
from app.repositories.reminder_repository import ReminderRepository
from app.repositories.task_repository import TaskRepository
from app.schemas.reminder import ReminderCreate, ReminderUpdate


class ReminderService:
    """Orchestrates reminder use cases, enforcing ownership rules.

    Reminder dispatch itself is owned by notification-service; this
    service only schedules/cancels notifications via NotificationClient
    when a reminder is created, updated, or deleted. If the linked task
    or meeting belongs to another user, creation is rejected.
    """

    def __init__(
        self,
        db: AsyncSession,
        notification_client: Optional[NotificationClient] = None,
    ) -> None:
        self.db = db
        self.reminders = ReminderRepository(db)
        self.tasks = TaskRepository(db)
        self.meetings = MeetingRepository(db)
        self.notification_client = notification_client or NotificationClient()

    async def create_reminder(
        self, user_id: uuid.UUID, payload: ReminderCreate
    ) -> Reminder:
        if payload.task_id is not None:
            task = await self.tasks.get_by_id(payload.task_id, with_tags=False)
            if task is None:
                raise NotFoundError("Task")
            if task.user_id != user_id:
                raise ForbiddenError("You do not have access to this task")

        if payload.meeting_id is not None:
            meeting = await self.meetings.get_by_id(
                payload.meeting_id, with_participants=False
            )
            if meeting is None:
                raise NotFoundError("Meeting")
            if meeting.user_id != user_id:
                raise ForbiddenError("You do not have access to this meeting")

        reminder = await self.reminders.create(
            user_id=user_id,
            remind_at=payload.remind_at,
            message=payload.message,
            task_id=payload.task_id,
            meeting_id=payload.meeting_id,
        )
        await self.db.commit()

        await self.notification_client.schedule_reminder_notification(
            reminder_id=reminder.id,
            user_id=user_id,
            remind_at=reminder.remind_at,
            message=reminder.message,
        )
        return reminder

    async def get_reminder(
        self, user_id: uuid.UUID, reminder_id: uuid.UUID
    ) -> Reminder:
        reminder = await self.reminders.get_by_id(reminder_id)
        if reminder is None:
            raise NotFoundError("Reminder")
        self._assert_owner(reminder, user_id)
        return reminder

    async def list_reminders(
        self,
        user_id: uuid.UUID,
        *,
        offset: int,
        limit: int,
        is_sent: Optional[bool] = None,
    ) -> Tuple[List[Reminder], int]:
        return await self.reminders.list_for_user(
            user_id, offset=offset, limit=limit, is_sent=is_sent
        )

    async def update_reminder(
        self,
        user_id: uuid.UUID,
        reminder_id: uuid.UUID,
        payload: ReminderUpdate,
    ) -> Reminder:
        reminder = await self.get_reminder(user_id, reminder_id)
        if reminder.is_sent:
            raise ValidationError("Cannot modify a reminder that has already fired")

        updated = await self.reminders.update(
            reminder, remind_at=payload.remind_at, message=payload.message
        )
        await self.db.commit()

        if payload.remind_at is not None or payload.message is not None:
            await self.notification_client.schedule_reminder_notification(
                reminder_id=updated.id,
                user_id=user_id,
                remind_at=updated.remind_at,
                message=updated.message,
            )
        return updated

    async def delete_reminder(
        self, user_id: uuid.UUID, reminder_id: uuid.UUID
    ) -> None:
        reminder = await self.get_reminder(user_id, reminder_id)
        await self.reminders.delete(reminder)
        await self.db.commit()
        await self.notification_client.cancel_reminder_notification(
            reminder_id=reminder_id
        )

    @staticmethod
    def _assert_owner(reminder: Reminder, user_id: uuid.UUID) -> None:
        if reminder.user_id != user_id:
            raise ForbiddenError("You do not have access to this reminder")
TODOTAK_EOF

echo '==> Writing core-service/app/services/task_service.py'
cat > "core-service/app/services/task_service.py" << 'TODOTAK_EOF'
"""Business logic for task management."""
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.task import Task, TaskPriority, TaskStatus
from app.repositories.task_repository import TaskRepository
from app.schemas.task import TaskCreate, TaskUpdate


class TaskService:
    """Orchestrates task use cases, enforcing ownership rules."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.tasks = TaskRepository(db)

    async def create_task(self, user_id: uuid.UUID, payload: TaskCreate) -> Task:
        task = await self.tasks.create(
            user_id=user_id,
            title=payload.title,
            description=payload.description,
            priority=payload.priority,
            due_date=payload.due_date,
            tags=payload.tags,
        )
        await self.db.commit()
        return task

    async def get_task(self, user_id: uuid.UUID, task_id: uuid.UUID) -> Task:
        task = await self.tasks.get_by_id(task_id)
        if task is None:
            raise NotFoundError("Task")
        self._assert_owner(task, user_id)
        return task

    async def list_tasks(
        self,
        user_id: uuid.UUID,
        *,
        offset: int,
        limit: int,
        status: Optional[TaskStatus] = None,
        priority: Optional[TaskPriority] = None,
        due_before: Optional[datetime] = None,
        due_after: Optional[datetime] = None,
        tag: Optional[str] = None,
    ) -> Tuple[List[Task], int]:
        return await self.tasks.list_for_user(
            user_id,
            offset=offset,
            limit=limit,
            status=status,
            priority=priority,
            due_before=due_before,
            due_after=due_after,
            tag=tag,
        )

    async def update_task(
        self, user_id: uuid.UUID, task_id: uuid.UUID, payload: TaskUpdate
    ) -> Task:
        task = await self.get_task(user_id, task_id)

        completed_at = None
        clear_completed_at = False
        if payload.status == TaskStatus.COMPLETED and task.status != TaskStatus.COMPLETED:
            completed_at = datetime.now(timezone.utc)
        elif payload.status is not None and payload.status != TaskStatus.COMPLETED:
            clear_completed_at = True

        updated = await self.tasks.update(
            task,
            title=payload.title,
            description=payload.description,
            status=payload.status,
            priority=payload.priority,
            due_date=payload.due_date,
            completed_at=completed_at,
            clear_completed_at=clear_completed_at,
        )
        await self.db.commit()
        return updated

    async def replace_tags(
        self, user_id: uuid.UUID, task_id: uuid.UUID, tags: List[str]
    ) -> Task:
        task = await self.get_task(user_id, task_id)
        normalized = sorted({t.strip().lower() for t in tags if t.strip()})
        updated = await self.tasks.replace_tags(task, normalized)
        await self.db.commit()
        return updated

    async def delete_task(self, user_id: uuid.UUID, task_id: uuid.UUID) -> None:
        task = await self.get_task(user_id, task_id)
        await self.tasks.delete(task)
        await self.db.commit()

    @staticmethod
    def _assert_owner(task: Task, user_id: uuid.UUID) -> None:
        if task.user_id != user_id:
            raise ForbiddenError("You do not have access to this task")
TODOTAK_EOF

echo '==> Writing core-service/requirements.txt'
cat > "core-service/requirements.txt" << 'TODOTAK_EOF'
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy==2.0.35
asyncpg==0.29.0
alembic==1.13.2
pydantic==2.9.2
pydantic-settings==2.5.2
email-validator==2.2.0
python-jose[cryptography]==3.3.0
python-multipart==0.0.9
redis==5.0.8
httpx==0.27.2
pytest==8.3.3
pytest-asyncio==0.24.0
TODOTAK_EOF

echo '==> Writing core-service/tests/__init__.py'
cat > "core-service/tests/__init__.py" << 'TODOTAK_EOF'

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

echo '==> Writing core-service/tests/test_meetings.py'
cat > "core-service/tests/test_meetings.py" << 'TODOTAK_EOF'
"""Integration tests for the meeting API."""
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


def _meeting_payload() -> dict:
    start = datetime.now(timezone.utc) + timedelta(days=1)
    end = start + timedelta(hours=1)
    return {
        "title": "Sprint planning",
        "description": "Plan next sprint",
        "location": "Zoom",
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "participants": [
            {"email": "teammate@example.com", "name": "Teammate"}
        ],
    }


async def test_create_meeting(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.post(
        "/api/v1/meetings", json=_meeting_payload(), headers=auth_headers
    )
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Sprint planning"
    assert body["status"] == "scheduled"
    assert len(body["participants"]) == 1
    assert body["participants"][0]["response_status"] == "pending"


async def test_create_meeting_rejects_invalid_time_range(
    client: AsyncClient, auth_headers: dict
) -> None:
    payload = _meeting_payload()
    payload["end_time"] = payload["start_time"]
    response = await client.post(
        "/api/v1/meetings", json=payload, headers=auth_headers
    )
    assert response.status_code == 422


async def test_cancel_meeting(client: AsyncClient, auth_headers: dict) -> None:
    create_response = await client.post(
        "/api/v1/meetings", json=_meeting_payload(), headers=auth_headers
    )
    meeting_id = create_response.json()["id"]

    cancel_response = await client.post(
        f"/api/v1/meetings/{meeting_id}/cancel", headers=auth_headers
    )
    assert cancel_response.status_code == 200
    assert cancel_response.json()["status"] == "cancelled"


async def test_update_participant_response(
    client: AsyncClient, auth_headers: dict
) -> None:
    create_response = await client.post(
        "/api/v1/meetings", json=_meeting_payload(), headers=auth_headers
    )
    body = create_response.json()
    meeting_id = body["id"]
    participant_id = body["participants"][0]["id"]

    response = await client.patch(
        f"/api/v1/meetings/{meeting_id}/participants/{participant_id}",
        json={"response_status": "accepted"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    updated_participant = next(
        p for p in response.json()["participants"] if p["id"] == participant_id
    )
    assert updated_participant["response_status"] == "accepted"


async def test_list_meetings_filters_by_status(
    client: AsyncClient, auth_headers: dict
) -> None:
    create_response = await client.post(
        "/api/v1/meetings", json=_meeting_payload(), headers=auth_headers
    )
    meeting_id = create_response.json()["id"]
    await client.post(
        f"/api/v1/meetings/{meeting_id}/cancel", headers=auth_headers
    )

    response = await client.get(
        "/api/v1/meetings", params={"status": "cancelled"}, headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == meeting_id
TODOTAK_EOF

echo '==> Writing core-service/tests/test_reminders.py'
cat > "core-service/tests/test_reminders.py" << 'TODOTAK_EOF'
"""Integration tests for the reminder API.

The NotificationClient calls out to notification-service over HTTP;
in this test environment that service isn't running, so those calls
fail fast and are swallowed by NotificationClient (see
app/clients/notification_client.py), which does not affect these
assertions.
"""
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


def _reminder_payload(**overrides) -> dict:
    payload = {
        "remind_at": (
            datetime.now(timezone.utc) + timedelta(hours=2)
        ).isoformat(),
        "message": "Don't forget the standup",
    }
    payload.update(overrides)
    return payload


async def test_create_standalone_reminder(
    client: AsyncClient, auth_headers: dict
) -> None:
    response = await client.post(
        "/api/v1/reminders", json=_reminder_payload(), headers=auth_headers
    )
    assert response.status_code == 201
    body = response.json()
    assert body["message"] == "Don't forget the standup"
    assert body["is_sent"] is False
    assert body["task_id"] is None
    assert body["meeting_id"] is None


async def test_create_reminder_rejects_both_task_and_meeting(
    client: AsyncClient, auth_headers: dict
) -> None:
    import uuid

    payload = _reminder_payload(
        task_id=str(uuid.uuid4()), meeting_id=str(uuid.uuid4())
    )
    response = await client.post(
        "/api/v1/reminders", json=payload, headers=auth_headers
    )
    assert response.status_code == 422


async def test_create_reminder_for_owned_task(
    client: AsyncClient, auth_headers: dict
) -> None:
    task_response = await client.post(
        "/api/v1/tasks",
        json={"title": "Buy groceries", "priority": "low"},
        headers=auth_headers,
    )
    task_id = task_response.json()["id"]

    response = await client.post(
        "/api/v1/reminders",
        json=_reminder_payload(task_id=task_id),
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["task_id"] == task_id


async def test_create_reminder_for_nonexistent_task_fails(
    client: AsyncClient, auth_headers: dict
) -> None:
    import uuid

    response = await client.post(
        "/api/v1/reminders",
        json=_reminder_payload(task_id=str(uuid.uuid4())),
        headers=auth_headers,
    )
    assert response.status_code == 404


async def test_update_reminder(client: AsyncClient, auth_headers: dict) -> None:
    create_response = await client.post(
        "/api/v1/reminders", json=_reminder_payload(), headers=auth_headers
    )
    reminder_id = create_response.json()["id"]

    new_time = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    response = await client.patch(
        f"/api/v1/reminders/{reminder_id}",
        json={"remind_at": new_time, "message": "Updated message"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Updated message"


async def test_delete_reminder(client: AsyncClient, auth_headers: dict) -> None:
    create_response = await client.post(
        "/api/v1/reminders", json=_reminder_payload(), headers=auth_headers
    )
    reminder_id = create_response.json()["id"]

    delete_response = await client.delete(
        f"/api/v1/reminders/{reminder_id}", headers=auth_headers
    )
    assert delete_response.status_code == 204

    get_response = await client.get(
        f"/api/v1/reminders/{reminder_id}", headers=auth_headers
    )
    assert get_response.status_code == 404


async def test_list_reminders_filters_by_sent_status(
    client: AsyncClient, auth_headers: dict
) -> None:
    await client.post(
        "/api/v1/reminders", json=_reminder_payload(), headers=auth_headers
    )
    response = await client.get(
        "/api/v1/reminders", params={"is_sent": False}, headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["total"] == 1
TODOTAK_EOF

echo '==> Writing core-service/tests/test_tasks.py'
cat > "core-service/tests/test_tasks.py" << 'TODOTAK_EOF'
"""Integration tests for the task API.

Requires TEST_DATABASE_URL pointed at a disposable Postgres instance;
the core schema/tables are created and torn down by the db_session
fixture in conftest.py.
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

TASK_PAYLOAD = {
    "title": "Finish auth-service tests",
    "description": "Write integration tests for the refresh flow",
    "priority": "high",
    "tags": ["backend", "Backend", "  urgent "],
}


async def test_create_task(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.post(
        "/api/v1/tasks", json=TASK_PAYLOAD, headers=auth_headers
    )
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == TASK_PAYLOAD["title"]
    assert body["status"] == "pending"
    tag_names = sorted(t["name"] for t in body["tags"])
    assert tag_names == ["backend", "urgent"]  # deduped + normalized


async def test_create_task_requires_auth(client: AsyncClient) -> None:
    response = await client.post("/api/v1/tasks", json=TASK_PAYLOAD)
    assert response.status_code == 401


async def test_get_task_not_found(client: AsyncClient, auth_headers: dict) -> None:
    response = await client.get(
        "/api/v1/tasks/00000000-0000-0000-0000-000000000000",
        headers=auth_headers,
    )
    assert response.status_code == 404


async def test_get_task_owned_by_another_user_is_forbidden(
    client: AsyncClient, auth_headers: dict
) -> None:
    import uuid
    from datetime import datetime, timedelta, timezone

    from jose import jwt

    from app.core.config import get_settings

    create_response = await client.post(
        "/api/v1/tasks", json=TASK_PAYLOAD, headers=auth_headers
    )
    task_id = create_response.json()["id"]

    # Build a validly-signed token for a *different* user id, so the
    # request passes authentication but should fail the ownership check.
    settings = get_settings()
    now = datetime.now(timezone.utc)
    other_user_payload = {
        "sub": str(uuid.uuid4()),
        "iat": now,
        "exp": now + timedelta(minutes=15),
        "type": "access",
        "jti": str(uuid.uuid4()),
    }
    other_token = jwt.encode(
        other_user_payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    other_user_headers = {"Authorization": f"Bearer {other_token}"}

    response = await client.get(
        f"/api/v1/tasks/{task_id}", headers=other_user_headers
    )
    assert response.status_code == 403


async def test_update_task_status_sets_completed_at(
    client: AsyncClient, auth_headers: dict
) -> None:
    create_response = await client.post(
        "/api/v1/tasks", json=TASK_PAYLOAD, headers=auth_headers
    )
    task_id = create_response.json()["id"]

    update_response = await client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"status": "completed"},
        headers=auth_headers,
    )
    assert update_response.status_code == 200
    body = update_response.json()
    assert body["status"] == "completed"
    assert body["completed_at"] is not None


async def test_list_tasks_filters_by_status(
    client: AsyncClient, auth_headers: dict
) -> None:
    await client.post("/api/v1/tasks", json=TASK_PAYLOAD, headers=auth_headers)
    second = {**TASK_PAYLOAD, "title": "Second task"}
    create_response = await client.post(
        "/api/v1/tasks", json=second, headers=auth_headers
    )
    task_id = create_response.json()["id"]
    await client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"status": "completed"},
        headers=auth_headers,
    )

    response = await client.get(
        "/api/v1/tasks", params={"status": "completed"}, headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["title"] == "Second task"


async def test_delete_task(client: AsyncClient, auth_headers: dict) -> None:
    create_response = await client.post(
        "/api/v1/tasks", json=TASK_PAYLOAD, headers=auth_headers
    )
    task_id = create_response.json()["id"]

    delete_response = await client.delete(
        f"/api/v1/tasks/{task_id}", headers=auth_headers
    )
    assert delete_response.status_code == 204

    get_response = await client.get(
        f"/api/v1/tasks/{task_id}", headers=auth_headers
    )
    assert get_response.status_code == 404
TODOTAK_EOF

echo '==> core-service files written successfully'
echo 'Next steps:'
echo '  1. cp core-service/.env.example core-service/.env and fill in real values'
echo '     (JWT_SECRET_KEY must match auth-service .env exactly)'
echo '  2. cd core-service && pip install -r requirements.txt'
echo '  3. alembic upgrade head   (after DATABASE_URL is set and Postgres is reachable)'
echo '  4. uvicorn app.main:app --reload'