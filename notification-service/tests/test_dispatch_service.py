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
