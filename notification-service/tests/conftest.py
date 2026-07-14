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
