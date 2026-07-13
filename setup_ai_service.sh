#!/usr/bin/env bash
# Todotak - ai-service full implementation
# Run this from the root of your todotak/ repo:
#   bash setup_ai_service.sh
set -euo pipefail

echo '==> Creating ai-service directories'
mkdir -p "ai-service"
mkdir -p "ai-service/alembic"
mkdir -p "ai-service/alembic/versions"
mkdir -p "ai-service/app"
mkdir -p "ai-service/app/api"
mkdir -p "ai-service/app/api/v1"
mkdir -p "ai-service/app/clients"
mkdir -p "ai-service/app/core"
mkdir -p "ai-service/app/db"
mkdir -p "ai-service/app/middleware"
mkdir -p "ai-service/app/models"
mkdir -p "ai-service/app/repositories"
mkdir -p "ai-service/app/schemas"
mkdir -p "ai-service/app/services"
mkdir -p "ai-service/app/tools"
mkdir -p "ai-service/tests"

echo '==> Writing ai-service/.env.example'
cat > "ai-service/.env.example" << 'TODOTAK_EOF'
ENVIRONMENT=development
DEBUG=true
SERVICE_NAME=ai-service

DATABASE_URL=postgresql+asyncpg://todotak:todotak@postgres:5432/todotak
REDIS_URL=redis://redis:6379/2

# Must match auth-service's values exactly so forwarded access tokens verify here.
JWT_SECRET_KEY=change-this-in-production-to-a-long-random-string
JWT_ALGORITHM=HS256

OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4o
OPENAI_TEMPERATURE=0.3
OPENAI_REQUEST_TIMEOUT_SECONDS=30.0
MAX_TOOL_ITERATIONS=5

CORE_SERVICE_URL=http://core-service:8000
CORE_SERVICE_TIMEOUT_SECONDS=10.0

CORS_ORIGINS=["http://localhost:3000"]

MAX_CONVERSATION_HISTORY_MESSAGES=40
TODOTAK_EOF

echo '==> Writing ai-service/Dockerfile'
cat > "ai-service/Dockerfile" << 'TODOTAK_EOF'
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

echo '==> Writing ai-service/alembic.ini'
cat > "ai-service/alembic.ini" << 'TODOTAK_EOF'
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

echo '==> Writing ai-service/alembic/env.py'
cat > "ai-service/alembic/env.py" << 'TODOTAK_EOF'
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
    Conversation,
    Message,
    ToolCallLog,
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
        version_table_schema="ai",
        include_schemas=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table_schema="ai",
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

echo '==> Writing ai-service/alembic/script.py.mako'
cat > "ai-service/alembic/script.py.mako" << 'TODOTAK_EOF'
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

echo '==> Writing ai-service/alembic/versions/0001_initial_ai_schema.py'
cat > "ai-service/alembic/versions/0001_initial_ai_schema.py" << 'TODOTAK_EOF'
"""initial ai schema

Revision ID: 0001
Revises:
Create Date: 2026-07-13 00:00:00.000000
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


message_role_enum = postgresql.ENUM(
    "system", "user", "assistant", "tool", name="message_role", schema="ai"
)
tool_call_status_enum = postgresql.ENUM(
    "success", "error", name="tool_call_status", schema="ai"
)


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS ai")

    bind = op.get_bind()
    message_role_enum.create(bind, checkfirst=True)
    tool_call_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(255), nullable=True),
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
        schema="ai",
    )
    op.create_index(
        "ix_ai_conversations_user_id",
        "conversations",
        ["user_id"],
        schema="ai",
    )

    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "conversation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ai.conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", message_role_enum, nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("tool_calls", postgresql.JSONB(), nullable=True),
        sa.Column("tool_call_id", sa.String(64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        schema="ai",
    )
    op.create_index(
        "ix_ai_messages_conversation_id",
        "messages",
        ["conversation_id"],
        schema="ai",
    )
    op.create_index(
        "ix_ai_messages_created_at", "messages", ["created_at"], schema="ai"
    )

    op.create_table(
        "tool_call_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "message_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ai.messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tool_name", sa.String(128), nullable=False),
        sa.Column("arguments", postgresql.JSONB(), nullable=False),
        sa.Column("result", postgresql.JSONB(), nullable=True),
        sa.Column("status", tool_call_status_enum, nullable=False),
        sa.Column("error_message", sa.String(1024), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        schema="ai",
    )
    op.create_index(
        "ix_ai_tool_call_logs_message_id",
        "tool_call_logs",
        ["message_id"],
        schema="ai",
    )
    op.create_index(
        "ix_ai_tool_call_logs_tool_name",
        "tool_call_logs",
        ["tool_name"],
        schema="ai",
    )


def downgrade() -> None:
    op.drop_table("tool_call_logs", schema="ai")
    op.drop_table("messages", schema="ai")
    op.drop_table("conversations", schema="ai")

    bind = op.get_bind()
    tool_call_status_enum.drop(bind, checkfirst=True)
    message_role_enum.drop(bind, checkfirst=True)

    op.execute("DROP SCHEMA IF EXISTS ai CASCADE")
TODOTAK_EOF

echo '==> Writing ai-service/app/__init__.py'
cat > "ai-service/app/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing ai-service/app/api/__init__.py'
cat > "ai-service/app/api/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing ai-service/app/api/deps.py'
cat > "ai-service/app/api/deps.py" << 'TODOTAK_EOF'
"""Shared FastAPI dependencies for the ai-service API layer."""
import uuid
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.core_service_client import CoreServiceClient
from app.clients.openai_client import OpenAIClient
from app.core.exceptions import AIServiceError
from app.core.security import get_user_id_from_token
from app.db.session import get_db
from app.services.chat_service import ChatService
from app.services.conversation_service import ConversationService
from app.tools.executor import ToolExecutor

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        bearer_scheme
    ),
) -> uuid.UUID:
    """Resolve the authenticated user's id from the access token."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        return get_user_id_from_token(credentials.credentials)
    except AIServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc


async def get_access_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        bearer_scheme
    ),
) -> str:
    """Return the raw bearer token, forwarded to core-service by tools."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return credentials.credentials


async def get_conversation_service(
    db: AsyncSession = Depends(get_db),
) -> ConversationService:
    return ConversationService(db)


async def get_chat_service(db: AsyncSession = Depends(get_db)) -> ChatService:
    openai_client = OpenAIClient()
    tool_executor = ToolExecutor(CoreServiceClient())
    return ChatService(db, openai_client, tool_executor)
TODOTAK_EOF

echo '==> Writing ai-service/app/api/v1/__init__.py'
cat > "ai-service/app/api/v1/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing ai-service/app/api/v1/chat.py'
cat > "ai-service/app/api/v1/chat.py" << 'TODOTAK_EOF'
"""Chat API route — the primary interface to the AI assistant."""
import uuid

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import (
    get_access_token,
    get_chat_service,
    get_current_user_id,
)
from app.core.exceptions import AIServiceError
from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.message import MessageResponse
from app.services.chat_service import ChatService

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    access_token: str = Depends(get_access_token),
    chat_service: ChatService = Depends(get_chat_service),
) -> ChatResponse:
    try:
        conversation, final_message, tool_messages = await chat_service.send_message(
            user_id, access_token, payload.conversation_id, payload.message
        )
    except AIServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc

    return ChatResponse(
        conversation_id=conversation.id,
        message=MessageResponse.model_validate(final_message),
        tool_messages=[
            MessageResponse.model_validate(m) for m in tool_messages
        ],
    )
TODOTAK_EOF

echo '==> Writing ai-service/app/api/v1/conversations.py'
cat > "ai-service/app/api/v1/conversations.py" << 'TODOTAK_EOF'
"""Conversation API routes."""
import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_conversation_service, get_current_user_id
from app.core.exceptions import AIServiceError
from app.schemas.common import PageResponse
from app.schemas.conversation import (
    ConversationDetail,
    ConversationSummary,
    ConversationUpdate,
)
from app.services.conversation_service import ConversationService

router = APIRouter(prefix="/ai/conversations", tags=["conversations"])


@router.get("", response_model=PageResponse[ConversationSummary])
async def list_conversations(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user_id: uuid.UUID = Depends(get_current_user_id),
    conversation_service: ConversationService = Depends(get_conversation_service),
) -> PageResponse[ConversationSummary]:
    offset = (page - 1) * page_size
    items, total = await conversation_service.list_conversations(
        user_id, offset=offset, limit=page_size
    )
    return PageResponse[ConversationSummary](
        items=[ConversationSummary.model_validate(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    conversation_service: ConversationService = Depends(get_conversation_service),
) -> ConversationDetail:
    try:
        conversation = await conversation_service.get_conversation(
            user_id, conversation_id
        )
    except AIServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return ConversationDetail.model_validate(conversation)


@router.patch("/{conversation_id}", response_model=ConversationSummary)
async def update_conversation(
    conversation_id: uuid.UUID,
    payload: ConversationUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    conversation_service: ConversationService = Depends(get_conversation_service),
) -> ConversationSummary:
    try:
        conversation = await conversation_service.update_conversation(
            user_id, conversation_id, payload
        )
    except AIServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return ConversationSummary.model_validate(conversation)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    conversation_service: ConversationService = Depends(get_conversation_service),
) -> None:
    try:
        await conversation_service.delete_conversation(user_id, conversation_id)
    except AIServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
TODOTAK_EOF

echo '==> Writing ai-service/app/clients/__init__.py'
cat > "ai-service/app/clients/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing ai-service/app/clients/core_service_client.py'
cat > "ai-service/app/clients/core_service_client.py" << 'TODOTAK_EOF'
"""HTTP client for ai-service -> core-service communication.

Every method forwards the caller's own access token, so core-service
enforces exactly the same ownership rules it would for a direct API
call — the agent never has elevated privileges over the user it acts
for, and never touches the database directly.
"""
from typing import Any, List, Optional

import httpx

from app.core.config import get_settings
from app.core.exceptions import ToolExecutionError

settings = get_settings()


class CoreServiceClient:
    """Thin async wrapper around core-service's HTTP API."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
        client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self.base_url = (base_url or settings.CORE_SERVICE_URL).rstrip("/")
        self.timeout = timeout or settings.CORE_SERVICE_TIMEOUT_SECONDS
        # Injectable for tests; a fresh client is opened/closed per
        # call when not supplied.
        self._client = client

    async def _request(
        self, method: str, path: str, access_token: str, **kwargs: Any
    ) -> Any:
        headers = {"Authorization": f"Bearer {access_token}"}
        client = self._client or httpx.AsyncClient()
        owns_client = self._client is None
        try:
            response = await client.request(
                method,
                f"{self.base_url}{path}",
                headers=headers,
                timeout=self.timeout,
                **kwargs,
            )
        except httpx.HTTPError as exc:
            raise ToolExecutionError(
                "Could not reach the task/meeting service. Please try again."
            ) from exc
        finally:
            if owns_client:
                await client.aclose()

        if response.status_code >= 400:
            raise ToolExecutionError(self._extract_detail(response))

        if response.status_code == 204 or not response.content:
            return None
        return response.json()

    @staticmethod
    def _extract_detail(response: httpx.Response) -> str:
        try:
            body = response.json()
            if isinstance(body, dict) and "detail" in body:
                return str(body["detail"])
        except ValueError:
            pass
        return f"core-service returned HTTP {response.status_code}"

    # -- Tasks ---------------------------------------------------------

    async def create_task(
        self,
        access_token: str,
        *,
        title: str,
        description: Optional[str] = None,
        priority: str = "medium",
        due_date: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> dict:
        payload: dict = {"title": title, "priority": priority}
        if description is not None:
            payload["description"] = description
        if due_date is not None:
            payload["due_date"] = due_date
        if tags is not None:
            payload["tags"] = tags
        return await self._request(
            "POST", "/api/v1/tasks", access_token, json=payload
        )

    async def list_tasks(
        self,
        access_token: str,
        *,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        tag: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        params: dict = {"page": page, "page_size": page_size}
        if status is not None:
            params["status"] = status
        if priority is not None:
            params["priority"] = priority
        if tag is not None:
            params["tag"] = tag
        return await self._request(
            "GET", "/api/v1/tasks", access_token, params=params
        )

    async def update_task(
        self, access_token: str, task_id: str, **fields: Any
    ) -> dict:
        payload = {k: v for k, v in fields.items() if v is not None}
        return await self._request(
            "PATCH", f"/api/v1/tasks/{task_id}", access_token, json=payload
        )

    async def delete_task(self, access_token: str, task_id: str) -> None:
        await self._request(
            "DELETE", f"/api/v1/tasks/{task_id}", access_token
        )

    # -- Meetings --------------------------------------------------------

    async def create_meeting(
        self,
        access_token: str,
        *,
        title: str,
        start_time: str,
        end_time: str,
        description: Optional[str] = None,
        location: Optional[str] = None,
        participants: Optional[List[dict]] = None,
    ) -> dict:
        payload: dict = {
            "title": title,
            "start_time": start_time,
            "end_time": end_time,
        }
        if description is not None:
            payload["description"] = description
        if location is not None:
            payload["location"] = location
        if participants is not None:
            payload["participants"] = participants
        return await self._request(
            "POST", "/api/v1/meetings", access_token, json=payload
        )

    async def list_meetings(
        self,
        access_token: str,
        *,
        status: Optional[str] = None,
        starts_after: Optional[str] = None,
        starts_before: Optional[str] = None,
    ) -> dict:
        params: dict = {}
        if status is not None:
            params["status"] = status
        if starts_after is not None:
            params["starts_after"] = starts_after
        if starts_before is not None:
            params["starts_before"] = starts_before
        return await self._request(
            "GET", "/api/v1/meetings", access_token, params=params
        )

    async def cancel_meeting(self, access_token: str, meeting_id: str) -> dict:
        return await self._request(
            "POST", f"/api/v1/meetings/{meeting_id}/cancel", access_token
        )

    # -- Reminders -------------------------------------------------------

    async def create_reminder(
        self,
        access_token: str,
        *,
        remind_at: str,
        message: Optional[str] = None,
        task_id: Optional[str] = None,
        meeting_id: Optional[str] = None,
    ) -> dict:
        payload: dict = {"remind_at": remind_at}
        if message is not None:
            payload["message"] = message
        if task_id is not None:
            payload["task_id"] = task_id
        if meeting_id is not None:
            payload["meeting_id"] = meeting_id
        return await self._request(
            "POST", "/api/v1/reminders", access_token, json=payload
        )

    async def list_reminders(
        self, access_token: str, *, is_sent: Optional[bool] = None
    ) -> dict:
        params: dict = {}
        if is_sent is not None:
            params["is_sent"] = is_sent
        return await self._request(
            "GET", "/api/v1/reminders", access_token, params=params
        )

    async def delete_reminder(self, access_token: str, reminder_id: str) -> None:
        await self._request(
            "DELETE", f"/api/v1/reminders/{reminder_id}", access_token
        )
TODOTAK_EOF

echo '==> Writing ai-service/app/clients/openai_client.py'
cat > "ai-service/app/clients/openai_client.py" << 'TODOTAK_EOF'
"""Wrapper around the OpenAI chat completions API with tool calling."""
import json
from dataclasses import dataclass, field
from typing import List, Optional

from openai import APIConnectionError, APIError, APITimeoutError, AsyncOpenAI

from app.core.config import get_settings
from app.core.exceptions import OpenAIRequestError

settings = get_settings()


@dataclass
class ToolCallRequest:
    """A single tool invocation requested by the model."""

    id: str
    name: str
    arguments: dict


@dataclass
class ChatCompletionResult:
    """Normalized result of a chat completion call."""

    content: Optional[str]
    tool_calls: List[ToolCallRequest] = field(default_factory=list)
    finish_reason: str = "stop"


class OpenAIClient:
    """Thin async wrapper around AsyncOpenAI's chat.completions API.

    Kept deliberately narrow so ChatService depends on this interface
    rather than the OpenAI SDK directly, making it easy to substitute
    a fake implementation in tests.
    """

    def __init__(
        self, api_key: Optional[str] = None, model: Optional[str] = None
    ) -> None:
        self._client = AsyncOpenAI(api_key=api_key or settings.OPENAI_API_KEY)
        self.model = model or settings.OPENAI_MODEL

    async def complete(
        self, messages: List[dict], tools: List[dict]
    ) -> ChatCompletionResult:
        try:
            response = await self._client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=tools,
                tool_choice="auto",
                temperature=settings.OPENAI_TEMPERATURE,
                timeout=settings.OPENAI_REQUEST_TIMEOUT_SECONDS,
            )
        except (APIError, APITimeoutError, APIConnectionError) as exc:
            raise OpenAIRequestError() from exc

        choice = response.choices[0]
        message = choice.message

        tool_calls: List[ToolCallRequest] = []
        if message.tool_calls:
            for call in message.tool_calls:
                try:
                    arguments = json.loads(call.function.arguments or "{}")
                except json.JSONDecodeError:
                    arguments = {}
                tool_calls.append(
                    ToolCallRequest(
                        id=call.id,
                        name=call.function.name,
                        arguments=arguments,
                    )
                )

        return ChatCompletionResult(
            content=message.content,
            tool_calls=tool_calls,
            finish_reason=choice.finish_reason or "stop",
        )
TODOTAK_EOF

echo '==> Writing ai-service/app/core/__init__.py'
cat > "ai-service/app/core/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing ai-service/app/core/config.py'
cat > "ai-service/app/core/config.py" << 'TODOTAK_EOF'
"""Application configuration loaded from environment variables."""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the ai-service."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    SERVICE_NAME: str = "ai-service"

    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/2"

    # Must match auth-service's values so tokens forwarded through the
    # gateway verify here without a network round-trip.
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"
    OPENAI_TEMPERATURE: float = 0.3
    OPENAI_REQUEST_TIMEOUT_SECONDS: float = 30.0
    MAX_TOOL_ITERATIONS: int = 5

    CORE_SERVICE_URL: str = "http://core-service:8000"
    CORE_SERVICE_TIMEOUT_SECONDS: float = 10.0

    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    MAX_CONVERSATION_HISTORY_MESSAGES: int = 40


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
TODOTAK_EOF

echo '==> Writing ai-service/app/core/exceptions.py'
cat > "ai-service/app/core/exceptions.py" << 'TODOTAK_EOF'
"""Domain-level exceptions for the ai-service."""


class AIServiceError(Exception):
    """Base class for all ai-service domain errors."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class InvalidTokenError(AIServiceError):
    """Raised when an access token is missing, invalid, or expired."""

    def __init__(self, message: str = "Invalid or expired token") -> None:
        super().__init__(message, status_code=401)


class NotFoundError(AIServiceError):
    """Raised when a requested resource does not exist."""

    def __init__(self, resource: str = "Resource") -> None:
        super().__init__(f"{resource} not found", status_code=404)


class ForbiddenError(AIServiceError):
    """Raised when a user attempts to access a conversation they don't own."""

    def __init__(self, message: str = "You do not have access to this resource") -> None:
        super().__init__(message, status_code=403)


class OpenAIRequestError(AIServiceError):
    """Raised when the OpenAI API call fails or times out."""

    def __init__(self, message: str = "The AI assistant is temporarily unavailable") -> None:
        super().__init__(message, status_code=502)


class ToolExecutionError(AIServiceError):
    """Raised when a tool call fails in a way that should stop the agent loop."""

    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=502)


class AgentLoopLimitError(AIServiceError):
    """Raised when the agent exceeds the configured tool-call iteration limit."""

    def __init__(self) -> None:
        super().__init__(
            "The assistant could not complete this request in a "
            "reasonable number of steps. Please try rephrasing.",
            status_code=502,
        )


class UnknownToolError(AIServiceError):
    """Raised when the model requests a tool that isn't registered."""

    def __init__(self, tool_name: str) -> None:
        super().__init__(f"Unknown tool requested: {tool_name}", status_code=502)
TODOTAK_EOF

echo '==> Writing ai-service/app/core/security.py'
cat > "ai-service/app/core/security.py" << 'TODOTAK_EOF'
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

echo '==> Writing ai-service/app/db/__init__.py'
cat > "ai-service/app/db/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing ai-service/app/db/base.py'
cat > "ai-service/app/db/base.py" << 'TODOTAK_EOF'
"""Declarative base class shared by all ai-service ORM models."""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models in this service."""
TODOTAK_EOF

echo '==> Writing ai-service/app/db/session.py'
cat > "ai-service/app/db/session.py" << 'TODOTAK_EOF'
"""Async SQLAlchemy engine and session factory for ai-service."""
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

echo '==> Writing ai-service/app/main.py'
cat > "ai-service/app/main.py" << 'TODOTAK_EOF'
"""AI-service FastAPI application entrypoint."""
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.chat import router as chat_router
from app.api.v1.conversations import router as conversations_router
from app.core.config import get_settings
from app.middleware.exception_handler import register_exception_handlers

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application startup/shutdown hooks."""
    yield


def create_app() -> FastAPI:
    """Application factory for the ai-service."""
    app = FastAPI(
        title="Todotak AI Service",
        description=(
            "Conversational AI assistant that manages tasks, meetings, "
            "and reminders via OpenAI tool calling."
        ),
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
    app.include_router(chat_router, prefix="/api/v1")
    app.include_router(conversations_router, prefix="/api/v1")

    @app.get("/health", tags=["health"])
    async def health_check() -> dict[str, str]:
        return {"status": "ok", "service": settings.SERVICE_NAME}

    return app


app = create_app()
TODOTAK_EOF

echo '==> Writing ai-service/app/middleware/__init__.py'
cat > "ai-service/app/middleware/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing ai-service/app/middleware/exception_handler.py'
cat > "ai-service/app/middleware/exception_handler.py" << 'TODOTAK_EOF'
"""Global exception handlers for the ai-service FastAPI app."""
import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.exceptions import AIServiceError

logger = logging.getLogger("ai-service")


def register_exception_handlers(app: FastAPI) -> None:
    """Attach domain, validation, and catch-all exception handlers."""

    @app.exception_handler(AIServiceError)
    async def ai_service_error_handler(
        request: Request, exc: AIServiceError
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
        logger.exception("Unhandled exception in ai-service", exc_info=exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )
TODOTAK_EOF

echo '==> Writing ai-service/app/models/__init__.py'
cat > "ai-service/app/models/__init__.py" << 'TODOTAK_EOF'
"""ORM models package.

Every model is imported here so that Base.metadata is fully populated
when Alembic (or anything else) imports app.models.
"""
from app.models.conversation import Conversation
from app.models.message import Message, MessageRole
from app.models.tool_call_log import ToolCallLog, ToolCallStatus

__all__ = [
    "Conversation",
    "Message",
    "MessageRole",
    "ToolCallLog",
    "ToolCallStatus",
]
TODOTAK_EOF

echo '==> Writing ai-service/app/models/conversation.py'
cat > "ai-service/app/models/conversation.py" << 'TODOTAK_EOF'
"""Conversation ORM model for the ai schema."""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Conversation(Base):
    """A chat thread between a user and the AI assistant."""

    __tablename__ = "conversations"
    __table_args__ = {"schema": "ai"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        onupdate=_utcnow,
        nullable=False,
    )

    messages: Mapped[List["Message"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )

    def __repr__(self) -> str:
        return f"<Conversation id={self.id} user_id={self.user_id} title={self.title!r}>"
TODOTAK_EOF

echo '==> Writing ai-service/app/models/message.py'
cat > "ai-service/app/models/message.py" << 'TODOTAK_EOF'
"""Message ORM model for the ai schema."""
import enum
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MessageRole(str, enum.Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class Message(Base):
    """A single turn in a conversation.

    `tool_calls` is populated on assistant messages that requested one
    or more tool invocations (mirrors the OpenAI `tool_calls` field).
    `tool_call_id` is populated on tool-role messages, linking the
    tool's result back to the specific call that produced it.
    """

    __tablename__ = "messages"
    __table_args__ = {"schema": "ai"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai.conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[MessageRole] = mapped_column(
        SAEnum(MessageRole, name="message_role", schema="ai"),
        nullable=False,
    )
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tool_calls: Mapped[Optional[List[dict]]] = mapped_column(
        JSONB, nullable=True
    )
    tool_call_id: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False, index=True
    )

    conversation: Mapped["Conversation"] = relationship(
        back_populates="messages"
    )
    tool_call_logs: Mapped[List["ToolCallLog"]] = relationship(
        back_populates="message", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Message id={self.id} role={self.role} conversation_id={self.conversation_id}>"
TODOTAK_EOF

echo '==> Writing ai-service/app/models/tool_call_log.py'
cat > "ai-service/app/models/tool_call_log.py" << 'TODOTAK_EOF'
"""ToolCallLog ORM model for the ai schema."""
import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ToolCallStatus(str, enum.Enum):
    SUCCESS = "success"
    ERROR = "error"


class ToolCallLog(Base):
    """An audit record of a single tool invocation made by the agent."""

    __tablename__ = "tool_call_logs"
    __table_args__ = {"schema": "ai"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai.messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tool_name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    arguments: Mapped[dict] = mapped_column(JSONB, nullable=False)
    result: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    status: Mapped[ToolCallStatus] = mapped_column(
        SAEnum(ToolCallStatus, name="tool_call_status", schema="ai"),
        nullable=False,
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        String(1024), nullable=True
    )
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )

    message: Mapped["Message"] = relationship(back_populates="tool_call_logs")

    def __repr__(self) -> str:
        return (
            f"<ToolCallLog id={self.id} tool_name={self.tool_name!r} "
            f"status={self.status}>"
        )
TODOTAK_EOF

echo '==> Writing ai-service/app/repositories/__init__.py'
cat > "ai-service/app/repositories/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing ai-service/app/repositories/conversation_repository.py'
cat > "ai-service/app/repositories/conversation_repository.py" << 'TODOTAK_EOF'
"""Data access layer for the Conversation model."""
import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.conversation import Conversation


class ConversationRepository:
    """Encapsulates all database access for Conversation rows."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(
        self, conversation_id: uuid.UUID, *, with_messages: bool = False
    ) -> Optional[Conversation]:
        stmt = select(Conversation).where(Conversation.id == conversation_id)
        if with_messages:
            stmt = stmt.options(selectinload(Conversation.messages))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_user(
        self, user_id: uuid.UUID, *, offset: int, limit: int
    ) -> Tuple[List[Conversation], int]:
        stmt = select(Conversation).where(Conversation.user_id == user_id)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = (
            stmt.order_by(Conversation.updated_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def create(
        self, *, user_id: uuid.UUID, title: Optional[str] = None
    ) -> Conversation:
        conversation = Conversation(user_id=user_id, title=title)
        self.db.add(conversation)
        await self.db.flush()
        await self.db.refresh(conversation)
        return conversation

    async def update_title(
        self, conversation: Conversation, title: str
    ) -> Conversation:
        conversation.title = title
        await self.db.flush()
        await self.db.refresh(conversation)
        return conversation

    async def touch(self, conversation: Conversation) -> None:
        """Bump updated_at (e.g. after a new message) without changing content."""
        await self.db.flush()

    async def delete(self, conversation: Conversation) -> None:
        await self.db.delete(conversation)
        await self.db.flush()
TODOTAK_EOF

echo '==> Writing ai-service/app/repositories/message_repository.py'
cat > "ai-service/app/repositories/message_repository.py" << 'TODOTAK_EOF'
"""Data access layer for the Message model."""
import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message, MessageRole


class MessageRepository:
    """Encapsulates all database access for Message rows."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_for_conversation(
        self, conversation_id: uuid.UUID, *, limit: Optional[int] = None
    ) -> List[Message]:
        stmt = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
        )
        result = await self.db.execute(stmt)
        messages = list(result.scalars().all())
        if limit is not None and len(messages) > limit:
            return messages[-limit:]
        return messages

    async def create(
        self,
        *,
        conversation_id: uuid.UUID,
        role: MessageRole,
        content: Optional[str] = None,
        tool_calls: Optional[List[dict]] = None,
        tool_call_id: Optional[str] = None,
    ) -> Message:
        message = Message(
            conversation_id=conversation_id,
            role=role,
            content=content,
            tool_calls=tool_calls,
            tool_call_id=tool_call_id,
        )
        self.db.add(message)
        await self.db.flush()
        await self.db.refresh(message)
        return message
TODOTAK_EOF

echo '==> Writing ai-service/app/repositories/tool_call_log_repository.py'
cat > "ai-service/app/repositories/tool_call_log_repository.py" << 'TODOTAK_EOF'
"""Data access layer for the ToolCallLog model."""
import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tool_call_log import ToolCallLog, ToolCallStatus


class ToolCallLogRepository:
    """Encapsulates all database access for ToolCallLog rows."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self,
        *,
        message_id: uuid.UUID,
        tool_name: str,
        arguments: dict,
        result: Optional[dict],
        status: ToolCallStatus,
        error_message: Optional[str] = None,
        duration_ms: Optional[int] = None,
    ) -> ToolCallLog:
        log = ToolCallLog(
            message_id=message_id,
            tool_name=tool_name,
            arguments=arguments,
            result=result,
            status=status,
            error_message=error_message,
            duration_ms=duration_ms,
        )
        self.db.add(log)
        await self.db.flush()
        await self.db.refresh(log)
        return log
TODOTAK_EOF

echo '==> Writing ai-service/app/schemas/__init__.py'
cat > "ai-service/app/schemas/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing ai-service/app/schemas/chat.py'
cat > "ai-service/app/schemas/chat.py" << 'TODOTAK_EOF'
"""Pydantic schemas for the chat endpoint."""
import uuid
from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.message import MessageResponse


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8_000)
    conversation_id: Optional[uuid.UUID] = None


class ChatResponse(BaseModel):
    conversation_id: uuid.UUID
    message: MessageResponse
    tool_messages: List[MessageResponse] = Field(default_factory=list)
TODOTAK_EOF

echo '==> Writing ai-service/app/schemas/common.py'
cat > "ai-service/app/schemas/common.py" << 'TODOTAK_EOF'
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

echo '==> Writing ai-service/app/schemas/conversation.py'
cat > "ai-service/app/schemas/conversation.py" << 'TODOTAK_EOF'
"""Pydantic schemas for conversation resources."""
import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.message import MessageResponse


class ConversationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: Optional[str]
    created_at: datetime
    updated_at: datetime


class ConversationDetail(ConversationSummary):
    messages: List[MessageResponse] = Field(default_factory=list)


class ConversationUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
TODOTAK_EOF

echo '==> Writing ai-service/app/schemas/message.py'
cat > "ai-service/app/schemas/message.py" << 'TODOTAK_EOF'
"""Pydantic schemas for message resources."""
import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict

from app.models.message import MessageRole


class ToolCallSchema(BaseModel):
    """Mirrors the shape of an OpenAI tool_call entry."""

    id: str
    name: str
    arguments: dict


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    role: MessageRole
    content: Optional[str]
    tool_calls: Optional[List[dict]]
    tool_call_id: Optional[str]
    created_at: datetime
TODOTAK_EOF

echo '==> Writing ai-service/app/services/__init__.py'
cat > "ai-service/app/services/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing ai-service/app/services/chat_service.py'
cat > "ai-service/app/services/chat_service.py" << 'TODOTAK_EOF'
"""The core agentic loop: user message in, tool calls resolved, final reply out.

This is the primary interface to Todotak's functionality per the
product's design — the model decides which of the registered tools
(create_task, list_meetings, etc.) to call based on the user's
natural-language request, and this service drives that loop, persists
every message and tool call for auditability, and returns the final
assistant reply.
"""
import json
import time
import uuid
from typing import List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.openai_client import OpenAIClient, ToolCallRequest
from app.core.config import get_settings
from app.core.exceptions import (
    AgentLoopLimitError,
    AIServiceError,
    ForbiddenError,
    NotFoundError,
)
from app.models.conversation import Conversation
from app.models.message import Message, MessageRole
from app.models.tool_call_log import ToolCallStatus
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.message_repository import MessageRepository
from app.repositories.tool_call_log_repository import ToolCallLogRepository
from app.tools.definitions import TOOL_DEFINITIONS
from app.tools.executor import ToolContext, ToolExecutor

SYSTEM_PROMPT = (
    "You are Todotak's AI assistant. You help the user manage their "
    "tasks, meetings, and reminders entirely through natural "
    "conversation. Use the available tools to create, list, update, "
    "or delete tasks and meetings, and to set reminders, whenever the "
    "user's request calls for it. Always confirm what you did in "
    "plain language after a tool call succeeds. If a tool call fails, "
    "explain the problem to the user without exposing raw error "
    "details, and suggest what they might try instead. Ask a "
    "clarifying question only when you genuinely cannot proceed "
    "without more information."
)


def _message_to_openai_dict(message: Message) -> dict:
    entry: dict = {"role": message.role.value, "content": message.content}
    if message.tool_calls:
        entry["tool_calls"] = message.tool_calls
    if message.tool_call_id:
        entry["tool_call_id"] = message.tool_call_id
    return entry


class ChatService:
    """Drives one user turn through the tool-calling agent loop."""

    def __init__(
        self,
        db: AsyncSession,
        openai_client: OpenAIClient,
        tool_executor: ToolExecutor,
    ) -> None:
        self.db = db
        self.conversations = ConversationRepository(db)
        self.messages = MessageRepository(db)
        self.tool_logs = ToolCallLogRepository(db)
        self.openai_client = openai_client
        self.tool_executor = tool_executor
        self.settings = get_settings()

    async def send_message(
        self,
        user_id: uuid.UUID,
        access_token: str,
        conversation_id: Optional[uuid.UUID],
        content: str,
    ) -> Tuple[Conversation, Message, List[Message]]:
        conversation = await self._get_or_create_conversation(
            user_id, conversation_id
        )
        await self.messages.create(
            conversation_id=conversation.id,
            role=MessageRole.USER,
            content=content,
        )
        await self.db.commit()

        context = ToolContext(user_id=user_id, access_token=access_token)
        tool_messages: List[Message] = []

        history = await self.messages.list_for_conversation(
            conversation.id, limit=self.settings.MAX_CONVERSATION_HISTORY_MESSAGES
        )
        openai_messages: List[dict] = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ] + [_message_to_openai_dict(m) for m in history]

        for _ in range(self.settings.MAX_TOOL_ITERATIONS):
            result = await self.openai_client.complete(
                messages=openai_messages, tools=TOOL_DEFINITIONS
            )

            if result.tool_calls:
                tool_call_dicts = [
                    {
                        "id": call.id,
                        "type": "function",
                        "function": {
                            "name": call.name,
                            "arguments": json.dumps(call.arguments),
                        },
                    }
                    for call in result.tool_calls
                ]
                assistant_message = await self.messages.create(
                    conversation_id=conversation.id,
                    role=MessageRole.ASSISTANT,
                    content=result.content,
                    tool_calls=tool_call_dicts,
                )
                await self.db.commit()
                openai_messages.append(_message_to_openai_dict(assistant_message))

                for call in result.tool_calls:
                    tool_result, status, error_message, duration_ms = (
                        await self._run_tool(call, context)
                    )

                    tool_message = await self.messages.create(
                        conversation_id=conversation.id,
                        role=MessageRole.TOOL,
                        content=json.dumps(tool_result, default=str),
                        tool_call_id=call.id,
                    )
                    await self.tool_logs.create(
                        message_id=assistant_message.id,
                        tool_name=call.name,
                        arguments=call.arguments,
                        result=tool_result if status == ToolCallStatus.SUCCESS else None,
                        status=status,
                        error_message=error_message,
                        duration_ms=duration_ms,
                    )
                    await self.db.commit()

                    tool_messages.append(tool_message)
                    openai_messages.append(_message_to_openai_dict(tool_message))

                continue

            final_message = await self.messages.create(
                conversation_id=conversation.id,
                role=MessageRole.ASSISTANT,
                content=result.content or "",
            )
            await self._maybe_set_title(conversation, content)
            await self.db.commit()
            return conversation, final_message, tool_messages

        raise AgentLoopLimitError()

    async def _run_tool(
        self, call: ToolCallRequest, context: ToolContext
    ) -> Tuple[dict, ToolCallStatus, Optional[str], int]:
        start = time.perf_counter()
        try:
            tool_result = await self.tool_executor.execute(
                call.name, call.arguments, context
            )
            status = ToolCallStatus.SUCCESS
            error_message = None
        except AIServiceError as exc:
            tool_result = {"error": exc.message}
            status = ToolCallStatus.ERROR
            error_message = exc.message
        duration_ms = int((time.perf_counter() - start) * 1000)
        return tool_result, status, error_message, duration_ms

    async def _get_or_create_conversation(
        self, user_id: uuid.UUID, conversation_id: Optional[uuid.UUID]
    ) -> Conversation:
        if conversation_id is not None:
            conversation = await self.conversations.get_by_id(conversation_id)
            if conversation is None:
                raise NotFoundError("Conversation")
            if conversation.user_id != user_id:
                raise ForbiddenError(
                    "You do not have access to this conversation"
                )
            return conversation

        conversation = await self.conversations.create(user_id=user_id)
        await self.db.commit()
        return conversation

    async def _maybe_set_title(
        self, conversation: Conversation, first_user_message: str
    ) -> None:
        if conversation.title is None:
            title = first_user_message.strip()[:80]
            await self.conversations.update_title(conversation, title)
TODOTAK_EOF

echo '==> Writing ai-service/app/services/conversation_service.py'
cat > "ai-service/app/services/conversation_service.py" << 'TODOTAK_EOF'
"""Business logic for conversation management."""
import uuid
from typing import List, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.conversation import Conversation
from app.repositories.conversation_repository import ConversationRepository
from app.schemas.conversation import ConversationUpdate


class ConversationService:
    """Orchestrates conversation use cases, enforcing ownership rules."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.conversations = ConversationRepository(db)

    async def get_conversation(
        self, user_id: uuid.UUID, conversation_id: uuid.UUID
    ) -> Conversation:
        conversation = await self.conversations.get_by_id(
            conversation_id, with_messages=True
        )
        if conversation is None:
            raise NotFoundError("Conversation")
        self._assert_owner(conversation, user_id)
        return conversation

    async def list_conversations(
        self, user_id: uuid.UUID, *, offset: int, limit: int
    ) -> Tuple[List[Conversation], int]:
        return await self.conversations.list_for_user(
            user_id, offset=offset, limit=limit
        )

    async def update_conversation(
        self,
        user_id: uuid.UUID,
        conversation_id: uuid.UUID,
        payload: ConversationUpdate,
    ) -> Conversation:
        conversation = await self.conversations.get_by_id(conversation_id)
        if conversation is None:
            raise NotFoundError("Conversation")
        self._assert_owner(conversation, user_id)
        if payload.title is not None:
            conversation = await self.conversations.update_title(
                conversation, payload.title
            )
        await self.db.commit()
        return conversation

    async def delete_conversation(
        self, user_id: uuid.UUID, conversation_id: uuid.UUID
    ) -> None:
        conversation = await self.conversations.get_by_id(conversation_id)
        if conversation is None:
            raise NotFoundError("Conversation")
        self._assert_owner(conversation, user_id)
        await self.conversations.delete(conversation)
        await self.db.commit()

    @staticmethod
    def _assert_owner(conversation: Conversation, user_id: uuid.UUID) -> None:
        if conversation.user_id != user_id:
            raise ForbiddenError("You do not have access to this conversation")
TODOTAK_EOF

echo '==> Writing ai-service/app/tools/__init__.py'
cat > "ai-service/app/tools/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing ai-service/app/tools/definitions.py'
cat > "ai-service/app/tools/definitions.py" << 'TODOTAK_EOF'
"""OpenAI tool (function-calling) definitions.

Each entry follows the OpenAI `tools` schema. Names here must exactly
match the keys registered in app.tools.executor.TOOL_HANDLERS.
"""
from typing import List

TOOL_DEFINITIONS: List[dict] = [
    {
        "type": "function",
        "function": {
            "name": "create_task",
            "description": (
                "Create a new to-do task for the user. Use this whenever "
                "the user asks to add, create, or remember a task or "
                "to-do item."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Short, clear title for the task.",
                    },
                    "description": {
                        "type": "string",
                        "description": "Optional longer description or notes.",
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["low", "medium", "high", "urgent"],
                        "description": "Task priority. Defaults to medium.",
                    },
                    "due_date": {
                        "type": "string",
                        "description": "ISO 8601 datetime the task is due, e.g. 2026-07-20T17:00:00Z.",
                    },
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Free-text labels for the task.",
                    },
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_tasks",
            "description": "List the user's tasks, optionally filtered by status, priority, or tag.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": ["pending", "in_progress", "completed", "cancelled"],
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["low", "medium", "high", "urgent"],
                    },
                    "tag": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_task",
            "description": (
                "Update an existing task's title, description, status, "
                "priority, or due date. Use status='completed' when the "
                "user says they finished a task."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "UUID of the task."},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "status": {
                        "type": "string",
                        "enum": ["pending", "in_progress", "completed", "cancelled"],
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["low", "medium", "high", "urgent"],
                    },
                    "due_date": {"type": "string"},
                },
                "required": ["task_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_task",
            "description": "Permanently delete a task.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "UUID of the task."},
                },
                "required": ["task_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_meeting",
            "description": "Schedule a new meeting, optionally inviting participants by email.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "location": {"type": "string"},
                    "start_time": {
                        "type": "string",
                        "description": "ISO 8601 start datetime.",
                    },
                    "end_time": {
                        "type": "string",
                        "description": "ISO 8601 end datetime, must be after start_time.",
                    },
                    "participants": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "email": {"type": "string"},
                                "name": {"type": "string"},
                            },
                            "required": ["email"],
                        },
                    },
                },
                "required": ["title", "start_time", "end_time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_meetings",
            "description": "List the user's meetings, optionally filtered by status or time range.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": ["scheduled", "cancelled", "completed"],
                    },
                    "starts_after": {"type": "string"},
                    "starts_before": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "cancel_meeting",
            "description": "Cancel an existing meeting.",
            "parameters": {
                "type": "object",
                "properties": {
                    "meeting_id": {"type": "string", "description": "UUID of the meeting."},
                },
                "required": ["meeting_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_reminder",
            "description": (
                "Create a reminder. It may stand alone, or be linked to "
                "exactly one existing task or meeting via task_id or "
                "meeting_id, not both."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "remind_at": {
                        "type": "string",
                        "description": "ISO 8601 datetime to send the reminder.",
                    },
                    "message": {"type": "string"},
                    "task_id": {"type": "string"},
                    "meeting_id": {"type": "string"},
                },
                "required": ["remind_at"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_reminders",
            "description": "List the user's reminders, optionally filtered by whether they've already fired.",
            "parameters": {
                "type": "object",
                "properties": {
                    "is_sent": {"type": "boolean"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_reminder",
            "description": "Delete a reminder.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reminder_id": {"type": "string", "description": "UUID of the reminder."},
                },
                "required": ["reminder_id"],
            },
        },
    },
]
TODOTAK_EOF

echo '==> Writing ai-service/app/tools/executor.py'
cat > "ai-service/app/tools/executor.py" << 'TODOTAK_EOF'
"""Dispatches model-requested tool calls to their concrete implementations.

Every handler receives the raw arguments dict the model produced, a
ToolContext carrying the caller's identity, and a CoreServiceClient to
act through. Handlers never touch the database directly — all state
changes go through core-service's HTTP API, which independently
enforces ownership.
"""
import uuid
from dataclasses import dataclass
from typing import Awaitable, Callable, Dict

from app.clients.core_service_client import CoreServiceClient
from app.core.exceptions import UnknownToolError


@dataclass
class ToolContext:
    """Identity of the user the agent is acting on behalf of."""

    user_id: uuid.UUID
    access_token: str


ToolHandler = Callable[[dict, ToolContext, CoreServiceClient], Awaitable[dict]]


async def _create_task(
    args: dict, ctx: ToolContext, client: CoreServiceClient
) -> dict:
    return await client.create_task(
        ctx.access_token,
        title=args["title"],
        description=args.get("description"),
        priority=args.get("priority", "medium"),
        due_date=args.get("due_date"),
        tags=args.get("tags"),
    )


async def _list_tasks(
    args: dict, ctx: ToolContext, client: CoreServiceClient
) -> dict:
    return await client.list_tasks(
        ctx.access_token,
        status=args.get("status"),
        priority=args.get("priority"),
        tag=args.get("tag"),
    )


async def _update_task(
    args: dict, ctx: ToolContext, client: CoreServiceClient
) -> dict:
    task_id = args["task_id"]
    return await client.update_task(
        ctx.access_token,
        task_id,
        title=args.get("title"),
        description=args.get("description"),
        status=args.get("status"),
        priority=args.get("priority"),
        due_date=args.get("due_date"),
    )


async def _delete_task(
    args: dict, ctx: ToolContext, client: CoreServiceClient
) -> dict:
    await client.delete_task(ctx.access_token, args["task_id"])
    return {"status": "deleted", "task_id": args["task_id"]}


async def _create_meeting(
    args: dict, ctx: ToolContext, client: CoreServiceClient
) -> dict:
    return await client.create_meeting(
        ctx.access_token,
        title=args["title"],
        start_time=args["start_time"],
        end_time=args["end_time"],
        description=args.get("description"),
        location=args.get("location"),
        participants=args.get("participants"),
    )


async def _list_meetings(
    args: dict, ctx: ToolContext, client: CoreServiceClient
) -> dict:
    return await client.list_meetings(
        ctx.access_token,
        status=args.get("status"),
        starts_after=args.get("starts_after"),
        starts_before=args.get("starts_before"),
    )


async def _cancel_meeting(
    args: dict, ctx: ToolContext, client: CoreServiceClient
) -> dict:
    return await client.cancel_meeting(ctx.access_token, args["meeting_id"])


async def _create_reminder(
    args: dict, ctx: ToolContext, client: CoreServiceClient
) -> dict:
    return await client.create_reminder(
        ctx.access_token,
        remind_at=args["remind_at"],
        message=args.get("message"),
        task_id=args.get("task_id"),
        meeting_id=args.get("meeting_id"),
    )


async def _list_reminders(
    args: dict, ctx: ToolContext, client: CoreServiceClient
) -> dict:
    return await client.list_reminders(
        ctx.access_token, is_sent=args.get("is_sent")
    )


async def _delete_reminder(
    args: dict, ctx: ToolContext, client: CoreServiceClient
) -> dict:
    await client.delete_reminder(ctx.access_token, args["reminder_id"])
    return {"status": "deleted", "reminder_id": args["reminder_id"]}


TOOL_HANDLERS: Dict[str, ToolHandler] = {
    "create_task": _create_task,
    "list_tasks": _list_tasks,
    "update_task": _update_task,
    "delete_task": _delete_task,
    "create_meeting": _create_meeting,
    "list_meetings": _list_meetings,
    "cancel_meeting": _cancel_meeting,
    "create_reminder": _create_reminder,
    "list_reminders": _list_reminders,
    "delete_reminder": _delete_reminder,
}


class ToolExecutor:
    """Looks up and invokes the handler for a requested tool name."""

    def __init__(self, core_client: CoreServiceClient) -> None:
        self.core_client = core_client

    async def execute(
        self, tool_name: str, arguments: dict, context: ToolContext
    ) -> dict:
        handler = TOOL_HANDLERS.get(tool_name)
        if handler is None:
            raise UnknownToolError(tool_name)
        result = await handler(arguments, context, self.core_client)
        return result if result is not None else {"status": "ok"}
TODOTAK_EOF

echo '==> Writing ai-service/requirements.txt'
cat > "ai-service/requirements.txt" << 'TODOTAK_EOF'
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
openai==1.51.0
redis==5.0.8
pytest==8.3.3
pytest-asyncio==0.24.0
asgi-lifespan==2.1.0
TODOTAK_EOF

echo '==> Writing ai-service/tests/__init__.py'
cat > "ai-service/tests/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing ai-service/tests/conftest.py'
cat > "ai-service/tests/conftest.py" << 'TODOTAK_EOF'
"""Shared pytest fixtures for ai-service tests that need a database.

Requires TEST_DATABASE_URL pointed at a disposable Postgres instance;
the ai schema/tables are created and torn down by the db_session
fixture. Tests in test_tool_definitions.py, test_core_service_client.py,
and test_tool_executor.py do not use this file's DB fixtures and run
without any external infrastructure.
"""
import asyncio
import os
import uuid
from datetime import timedelta
from typing import AsyncGenerator, List

import pytest
import pytest_asyncio
from asgi_lifespan import LifespanManager
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
os.environ.setdefault("OPENAI_API_KEY", "sk-test-not-a-real-key")

from app.clients.openai_client import ChatCompletionResult, ToolCallRequest  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models import Conversation, Message, ToolCallLog  # noqa: E402,F401


class FakeOpenAIClient:
    """Scriptable stand-in for OpenAIClient.

    Construct with a list of ChatCompletionResult objects; each call
    to `complete` pops the next one off the front. Lets tests drive
    the agent loop deterministically (e.g. tool call, then final
    text) without any real OpenAI access.
    """

    def __init__(self, scripted_results: List[ChatCompletionResult]) -> None:
        self._results = list(scripted_results)
        self.calls: List[dict] = []

    async def complete(self, messages, tools) -> ChatCompletionResult:
        self.calls.append({"messages": messages, "tools": tools})
        if not self._results:
            raise AssertionError(
                "FakeOpenAIClient ran out of scripted results"
            )
        return self._results.pop(0)


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
            __import__("sqlalchemy").text("CREATE SCHEMA IF NOT EXISTS ai")
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
async def app_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    app = create_app()

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    async with LifespanManager(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport, base_url="http://testserver"
        ) as client:
            yield client

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
TODOTAK_EOF

echo '==> Writing ai-service/tests/test_chat_service.py'
cat > "ai-service/tests/test_chat_service.py" << 'TODOTAK_EOF'
"""Integration tests for ChatService's agent loop.

Requires TEST_DATABASE_URL (see conftest.py). The OpenAI and
core-service calls are both faked, so no external network access is
needed even though the database is real.
"""
import uuid

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.core_service_client import CoreServiceClient
from app.clients.openai_client import ChatCompletionResult, ToolCallRequest
from app.core.exceptions import AgentLoopLimitError, ForbiddenError, NotFoundError
from app.models.message import MessageRole
from app.models.tool_call_log import ToolCallStatus
from app.services.chat_service import ChatService
from app.tools.executor import ToolExecutor
from tests.conftest import FakeOpenAIClient

pytestmark = pytest.mark.asyncio


def _core_client_with_handler(handler) -> CoreServiceClient:
    http_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return CoreServiceClient(
        base_url="http://core-service:8000", client=http_client
    )


async def test_simple_reply_with_no_tool_calls(db_session: AsyncSession) -> None:
    fake_openai = FakeOpenAIClient(
        [ChatCompletionResult(content="Hi! How can I help?", tool_calls=[])]
    )
    tool_executor = ToolExecutor(
        _core_client_with_handler(lambda r: httpx.Response(200, json={}))
    )
    service = ChatService(db_session, fake_openai, tool_executor)
    user_id = uuid.uuid4()

    conversation, final_message, tool_messages = await service.send_message(
        user_id, "fake-token", None, "Hello there"
    )

    assert conversation.user_id == user_id
    assert final_message.role == MessageRole.ASSISTANT
    assert final_message.content == "Hi! How can I help?"
    assert tool_messages == []
    assert len(fake_openai.calls) == 1


async def test_conversation_title_set_from_first_message(
    db_session: AsyncSession,
) -> None:
    fake_openai = FakeOpenAIClient(
        [ChatCompletionResult(content="Sure thing.", tool_calls=[])]
    )
    tool_executor = ToolExecutor(
        _core_client_with_handler(lambda r: httpx.Response(200, json={}))
    )
    service = ChatService(db_session, fake_openai, tool_executor)

    conversation, _, _ = await service.send_message(
        uuid.uuid4(), "fake-token", None, "Remind me to call the bank tomorrow"
    )

    assert conversation.title == "Remind me to call the bank tomorrow"


async def test_tool_call_is_executed_and_looped_back(
    db_session: AsyncSession,
) -> None:
    fake_openai = FakeOpenAIClient(
        [
            ChatCompletionResult(
                content=None,
                tool_calls=[
                    ToolCallRequest(
                        id="call_1",
                        name="create_task",
                        arguments={"title": "Buy milk"},
                    )
                ],
            ),
            ChatCompletionResult(
                content="I've added 'Buy milk' to your tasks.", tool_calls=[]
            ),
        ]
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            201, json={"id": "task-123", "title": "Buy milk"}
        )

    tool_executor = ToolExecutor(_core_client_with_handler(handler))
    service = ChatService(db_session, fake_openai, tool_executor)

    conversation, final_message, tool_messages = await service.send_message(
        uuid.uuid4(), "fake-token", None, "Add buy milk to my tasks"
    )

    assert final_message.content == "I've added 'Buy milk' to your tasks."
    assert len(tool_messages) == 1
    assert tool_messages[0].role == MessageRole.TOOL
    assert tool_messages[0].tool_call_id == "call_1"
    assert "task-123" in tool_messages[0].content
    # The OpenAI client should have been called twice: once producing
    # the tool call, once producing the final reply after the tool
    # result was appended to history.
    assert len(fake_openai.calls) == 2
    second_call_messages = fake_openai.calls[1]["messages"]
    assert any(m.get("role") == "tool" for m in second_call_messages)


async def test_tool_call_failure_is_surfaced_to_model_not_raised(
    db_session: AsyncSession,
) -> None:
    fake_openai = FakeOpenAIClient(
        [
            ChatCompletionResult(
                content=None,
                tool_calls=[
                    ToolCallRequest(
                        id="call_1",
                        name="delete_task",
                        arguments={"task_id": "missing"},
                    )
                ],
            ),
            ChatCompletionResult(
                content="I couldn't find that task.", tool_calls=[]
            ),
        ]
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"detail": "Task not found"})

    tool_executor = ToolExecutor(_core_client_with_handler(handler))
    service = ChatService(db_session, fake_openai, tool_executor)

    conversation, final_message, tool_messages = await service.send_message(
        uuid.uuid4(), "fake-token", None, "Delete task missing"
    )

    assert final_message.content == "I couldn't find that task."
    assert "Task not found" in tool_messages[0].content


async def test_continuing_existing_conversation(db_session: AsyncSession) -> None:
    fake_openai = FakeOpenAIClient(
        [
            ChatCompletionResult(content="First reply", tool_calls=[]),
            ChatCompletionResult(content="Second reply", tool_calls=[]),
        ]
    )
    tool_executor = ToolExecutor(
        _core_client_with_handler(lambda r: httpx.Response(200, json={}))
    )
    service = ChatService(db_session, fake_openai, tool_executor)
    user_id = uuid.uuid4()

    conversation, _, _ = await service.send_message(
        user_id, "fake-token", None, "First message"
    )
    conversation_again, final_message, _ = await service.send_message(
        user_id, "fake-token", conversation.id, "Second message"
    )

    assert conversation_again.id == conversation.id
    assert final_message.content == "Second reply"
    # Second OpenAI call should include the full prior history.
    second_call_messages = fake_openai.calls[1]["messages"]
    contents = [m.get("content") for m in second_call_messages]
    assert "First message" in contents
    assert "First reply" in contents


async def test_accessing_another_users_conversation_is_forbidden(
    db_session: AsyncSession,
) -> None:
    fake_openai = FakeOpenAIClient(
        [ChatCompletionResult(content="reply", tool_calls=[])]
    )
    tool_executor = ToolExecutor(
        _core_client_with_handler(lambda r: httpx.Response(200, json={}))
    )
    service = ChatService(db_session, fake_openai, tool_executor)

    owner_id = uuid.uuid4()
    conversation, _, _ = await service.send_message(
        owner_id, "fake-token", None, "hello"
    )

    other_openai = FakeOpenAIClient([])
    other_service = ChatService(db_session, other_openai, tool_executor)
    with pytest.raises(ForbiddenError):
        await other_service.send_message(
            uuid.uuid4(), "fake-token", conversation.id, "hi"
        )


async def test_nonexistent_conversation_raises_not_found(
    db_session: AsyncSession,
) -> None:
    fake_openai = FakeOpenAIClient([])
    tool_executor = ToolExecutor(
        _core_client_with_handler(lambda r: httpx.Response(200, json={}))
    )
    service = ChatService(db_session, fake_openai, tool_executor)

    with pytest.raises(NotFoundError):
        await service.send_message(
            uuid.uuid4(), "fake-token", uuid.uuid4(), "hi"
        )


async def test_exceeding_max_tool_iterations_raises(
    db_session: AsyncSession,
) -> None:
    settings_module = __import__(
        "app.core.config", fromlist=["get_settings"]
    )
    max_iterations = settings_module.get_settings().MAX_TOOL_ITERATIONS

    endless_tool_call = ChatCompletionResult(
        content=None,
        tool_calls=[
            ToolCallRequest(id="call_x", name="list_tasks", arguments={})
        ],
    )
    fake_openai = FakeOpenAIClient([endless_tool_call] * max_iterations)
    tool_executor = ToolExecutor(
        _core_client_with_handler(
            lambda r: httpx.Response(200, json={"items": [], "total": 0})
        )
    )
    service = ChatService(db_session, fake_openai, tool_executor)

    with pytest.raises(AgentLoopLimitError):
        await service.send_message(
            uuid.uuid4(), "fake-token", None, "loop forever please"
        )
TODOTAK_EOF

echo '==> Writing ai-service/tests/test_conversations_api.py'
cat > "ai-service/tests/test_conversations_api.py" << 'TODOTAK_EOF'
"""Integration tests for the conversation API.

Requires TEST_DATABASE_URL (see conftest.py).
"""
import uuid

import httpx
import pytest
from httpx import AsyncClient

from app.clients.core_service_client import CoreServiceClient
from app.clients.openai_client import ChatCompletionResult
from app.services.chat_service import ChatService
from app.tools.executor import ToolExecutor
from tests.conftest import FakeOpenAIClient

pytestmark = pytest.mark.asyncio


async def _seed_conversation(db_session, user_id: uuid.UUID, text: str = "Hello"):
    fake_openai = FakeOpenAIClient(
        [ChatCompletionResult(content="Hi there!", tool_calls=[])]
    )
    core_client = CoreServiceClient(
        base_url="http://core-service:8000",
        client=httpx.AsyncClient(
            transport=httpx.MockTransport(lambda r: httpx.Response(200, json={}))
        ),
    )
    service = ChatService(db_session, fake_openai, ToolExecutor(core_client))
    conversation, _, _ = await service.send_message(
        user_id, "fake-token", None, text
    )
    return conversation


async def test_list_conversations_requires_auth(app_client: AsyncClient) -> None:
    response = await app_client.get("/api/v1/ai/conversations")
    assert response.status_code == 401


async def test_list_conversations_empty(
    app_client: AsyncClient, auth_headers: dict
) -> None:
    response = await app_client.get(
        "/api/v1/ai/conversations", headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


async def test_get_conversation_includes_messages(
    app_client: AsyncClient, db_session, test_user_id, auth_headers: dict
) -> None:
    conversation = await _seed_conversation(db_session, test_user_id)

    response = await app_client.get(
        f"/api/v1/ai/conversations/{conversation.id}", headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(conversation.id)
    roles = [m["role"] for m in body["messages"]]
    assert roles == ["user", "assistant"]


async def test_get_conversation_not_found(
    app_client: AsyncClient, auth_headers: dict
) -> None:
    response = await app_client.get(
        f"/api/v1/ai/conversations/{uuid.uuid4()}", headers=auth_headers
    )
    assert response.status_code == 404


async def test_get_other_users_conversation_is_forbidden(
    app_client: AsyncClient, db_session, auth_headers: dict
) -> None:
    other_user_id = uuid.uuid4()
    conversation = await _seed_conversation(db_session, other_user_id)

    response = await app_client.get(
        f"/api/v1/ai/conversations/{conversation.id}", headers=auth_headers
    )
    assert response.status_code == 403


async def test_update_conversation_title(
    app_client: AsyncClient, db_session, test_user_id, auth_headers: dict
) -> None:
    conversation = await _seed_conversation(db_session, test_user_id)

    response = await app_client.patch(
        f"/api/v1/ai/conversations/{conversation.id}",
        json={"title": "Renamed"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Renamed"


async def test_delete_conversation(
    app_client: AsyncClient, db_session, test_user_id, auth_headers: dict
) -> None:
    conversation = await _seed_conversation(db_session, test_user_id)

    delete_response = await app_client.delete(
        f"/api/v1/ai/conversations/{conversation.id}", headers=auth_headers
    )
    assert delete_response.status_code == 204

    get_response = await app_client.get(
        f"/api/v1/ai/conversations/{conversation.id}", headers=auth_headers
    )
    assert get_response.status_code == 404
TODOTAK_EOF

echo '==> Writing ai-service/tests/test_core_service_client.py'
cat > "ai-service/tests/test_core_service_client.py" << 'TODOTAK_EOF'
"""Unit tests for CoreServiceClient.

These use httpx.MockTransport to stand in for core-service, so they
run with no database and no real network access.
"""
import os

import httpx
import pytest

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-unit-tests-only")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/unused"
)

from app.clients.core_service_client import CoreServiceClient  # noqa: E402
from app.core.exceptions import ToolExecutionError  # noqa: E402

pytestmark = pytest.mark.asyncio

FAKE_TOKEN = "fake-access-token"


def _client_with_handler(handler) -> CoreServiceClient:
    mock_transport = httpx.MockTransport(handler)
    http_client = httpx.AsyncClient(transport=mock_transport)
    return CoreServiceClient(
        base_url="http://core-service:8000", client=http_client
    )


async def test_create_task_sends_expected_request() -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["method"] = request.method
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("authorization")
        captured["body"] = request.content
        return httpx.Response(201, json={"id": "task-1", "title": "Buy milk"})

    client = _client_with_handler(handler)
    result = await client.create_task(FAKE_TOKEN, title="Buy milk")

    assert result == {"id": "task-1", "title": "Buy milk"}
    assert captured["method"] == "POST"
    assert captured["url"] == "http://core-service:8000/api/v1/tasks"
    assert captured["auth"] == f"Bearer {FAKE_TOKEN}"
    assert b'"title":"Buy milk"' in captured["body"]


async def test_list_tasks_sends_query_params() -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["query"] = dict(request.url.params)
        return httpx.Response(200, json={"items": [], "total": 0})

    client = _client_with_handler(handler)
    await client.list_tasks(FAKE_TOKEN, status="completed", tag="work")

    assert captured["query"]["status"] == "completed"
    assert captured["query"]["tag"] == "work"


async def test_delete_task_returns_none_on_204() -> None:
    client = _client_with_handler(lambda request: httpx.Response(204))
    result = await client.delete_task(FAKE_TOKEN, "task-1")
    assert result is None


async def test_error_response_raises_tool_execution_error_with_detail() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"detail": "Task not found"})

    client = _client_with_handler(handler)
    with pytest.raises(ToolExecutionError) as exc_info:
        await client.update_task(FAKE_TOKEN, "missing-id", title="New title")

    assert "Task not found" in str(exc_info.value)


async def test_connection_failure_raises_tool_execution_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused", request=request)

    client = _client_with_handler(handler)
    with pytest.raises(ToolExecutionError):
        await client.list_meetings(FAKE_TOKEN)


async def test_create_reminder_omits_unset_optional_fields() -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = request.content
        return httpx.Response(201, json={"id": "reminder-1"})

    client = _client_with_handler(handler)
    await client.create_reminder(FAKE_TOKEN, remind_at="2026-08-01T10:00:00Z")

    assert b"task_id" not in captured["body"]
    assert b"meeting_id" not in captured["body"]
TODOTAK_EOF

echo '==> Writing ai-service/tests/test_tool_definitions.py'
cat > "ai-service/tests/test_tool_definitions.py" << 'TODOTAK_EOF'
"""Structural tests for the OpenAI tool/function definitions.

These run with no database and no network access — they only check
that the schema handed to OpenAI is well-formed and stays in sync
with the registered tool handlers.
"""
from app.tools.definitions import TOOL_DEFINITIONS
from app.tools.executor import TOOL_HANDLERS


def test_every_definition_has_required_openai_fields() -> None:
    for definition in TOOL_DEFINITIONS:
        assert definition["type"] == "function"
        function = definition["function"]
        assert isinstance(function["name"], str) and function["name"]
        assert isinstance(function["description"], str) and function["description"]
        parameters = function["parameters"]
        assert parameters["type"] == "object"
        assert "properties" in parameters


def test_tool_names_are_unique() -> None:
    names = [d["function"]["name"] for d in TOOL_DEFINITIONS]
    assert len(names) == len(set(names))


def test_every_definition_has_a_registered_handler() -> None:
    definition_names = {d["function"]["name"] for d in TOOL_DEFINITIONS}
    handler_names = set(TOOL_HANDLERS.keys())
    assert definition_names == handler_names


def test_required_parameters_are_declared_in_properties() -> None:
    for definition in TOOL_DEFINITIONS:
        parameters = definition["function"]["parameters"]
        required = parameters.get("required", [])
        for field_name in required:
            assert field_name in parameters["properties"], (
                f"{definition['function']['name']} lists {field_name!r} as "
                "required but does not define it in properties"
            )


def test_create_task_requires_only_title() -> None:
    create_task = next(
        d for d in TOOL_DEFINITIONS if d["function"]["name"] == "create_task"
    )
    assert create_task["function"]["parameters"]["required"] == ["title"]


def test_create_reminder_allows_task_or_meeting_link() -> None:
    create_reminder = next(
        d for d in TOOL_DEFINITIONS if d["function"]["name"] == "create_reminder"
    )
    properties = create_reminder["function"]["parameters"]["properties"]
    assert "task_id" in properties
    assert "meeting_id" in properties
TODOTAK_EOF

echo '==> Writing ai-service/tests/test_tool_executor.py'
cat > "ai-service/tests/test_tool_executor.py" << 'TODOTAK_EOF'
"""Unit tests for ToolExecutor.

Uses a CoreServiceClient backed by httpx.MockTransport, so these tests
run with no database and no real network access.
"""
import os
import uuid

import httpx
import pytest

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-unit-tests-only")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/unused"
)

from app.clients.core_service_client import CoreServiceClient  # noqa: E402
from app.core.exceptions import UnknownToolError  # noqa: E402
from app.tools.executor import ToolContext, ToolExecutor  # noqa: E402

pytestmark = pytest.mark.asyncio


def _executor_with_handler(handler) -> ToolExecutor:
    mock_transport = httpx.MockTransport(handler)
    http_client = httpx.AsyncClient(transport=mock_transport)
    core_client = CoreServiceClient(
        base_url="http://core-service:8000", client=http_client
    )
    return ToolExecutor(core_client)


@pytest.fixture
def context() -> ToolContext:
    return ToolContext(user_id=uuid.uuid4(), access_token="fake-token")


async def test_execute_create_task_returns_core_service_response(
    context: ToolContext,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(201, json={"id": "task-1", "title": "Buy milk"})

    executor = _executor_with_handler(handler)
    result = await executor.execute(
        "create_task", {"title": "Buy milk"}, context
    )
    assert result == {"id": "task-1", "title": "Buy milk"}


async def test_execute_delete_task_returns_status_dict(
    context: ToolContext,
) -> None:
    executor = _executor_with_handler(lambda request: httpx.Response(204))
    result = await executor.execute(
        "delete_task", {"task_id": "task-1"}, context
    )
    assert result == {"status": "deleted", "task_id": "task-1"}


async def test_execute_unknown_tool_raises(context: ToolContext) -> None:
    executor = _executor_with_handler(lambda request: httpx.Response(200))
    with pytest.raises(UnknownToolError):
        await executor.execute("not_a_real_tool", {}, context)


async def test_execute_forwards_access_token_from_context() -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["auth"] = request.headers.get("authorization")
        return httpx.Response(200, json={"items": [], "total": 0})

    executor = _executor_with_handler(handler)
    ctx = ToolContext(user_id=uuid.uuid4(), access_token="specific-token-abc")
    await executor.execute("list_tasks", {}, ctx)

    assert captured["auth"] == "Bearer specific-token-abc"


async def test_execute_create_meeting_passes_participants(
    context: ToolContext,
) -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = request.content
        return httpx.Response(201, json={"id": "meeting-1"})

    executor = _executor_with_handler(handler)
    await executor.execute(
        "create_meeting",
        {
            "title": "Sync",
            "start_time": "2026-08-01T10:00:00Z",
            "end_time": "2026-08-01T11:00:00Z",
            "participants": [{"email": "a@example.com"}],
        },
        context,
    )
    assert b"a@example.com" in captured["body"]
TODOTAK_EOF

echo '==> ai-service files written successfully'
echo 'Next steps:'
echo '  1. cp ai-service/.env.example ai-service/.env and fill in real values'
echo '     (JWT_SECRET_KEY must match auth-service .env; add your real OPENAI_API_KEY)'
echo '  2. cd ai-service && pip install -r requirements.txt'
echo '  3. alembic upgrade head   (after DATABASE_URL is set and Postgres is reachable)'
echo '  4. pytest tests/test_tool_definitions.py tests/test_core_service_client.py tests/test_tool_executor.py'
echo '     (these run with no DB/network; the rest need TEST_DATABASE_URL)'
echo '  5. uvicorn app.main:app --reload'