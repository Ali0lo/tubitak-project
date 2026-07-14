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
