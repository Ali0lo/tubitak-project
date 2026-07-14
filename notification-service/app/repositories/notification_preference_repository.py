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
