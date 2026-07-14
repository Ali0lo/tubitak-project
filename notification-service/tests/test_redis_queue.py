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
