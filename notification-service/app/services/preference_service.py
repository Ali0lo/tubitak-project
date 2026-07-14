"""Business logic for notification preferences."""
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification_preference import NotificationPreference
from app.repositories.notification_preference_repository import (
    NotificationPreferenceRepository,
)


class PreferenceService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.preferences = NotificationPreferenceRepository(db)

    async def get_preference(self, user_id: uuid.UUID) -> NotificationPreference:
        preference = await self.preferences.get_or_create(user_id)
        await self.db.commit()
        return preference

    async def update_preference(
        self, user_id: uuid.UUID, *, email_enabled: bool
    ) -> NotificationPreference:
        preference = await self.preferences.get_or_create(user_id)
        preference = await self.preferences.update(
            preference, email_enabled=email_enabled
        )
        await self.db.commit()
        return preference
