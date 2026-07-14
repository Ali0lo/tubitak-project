"""Pydantic schemas for notification preference resources."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationPreferenceUpdate(BaseModel):
    email_enabled: bool


class NotificationPreferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    email_enabled: bool
    updated_at: datetime
