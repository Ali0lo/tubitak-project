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
