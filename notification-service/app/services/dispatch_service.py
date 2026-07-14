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
