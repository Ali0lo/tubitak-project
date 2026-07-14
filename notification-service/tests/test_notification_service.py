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
