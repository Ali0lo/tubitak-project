"""Pydantic schemas for notification resources."""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.notification import NotificationStatus


class ScheduleNotificationRequest(BaseModel):
    """Payload sent by an upstream service (e.g. core-service) to schedule
    or re-schedule a notification. `source` + `source_reference_id`
    together identify the originating record so re-sends upsert
    instead of duplicating.
    """

    source: str = Field(min_length=1, max_length=64)
    source_reference_id: str = Field(min_length=1, max_length=64)
    user_id: uuid.UUID
    scheduled_for: datetime
    message: str = Field(min_length=1, max_length=1024)


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    source: str
    source_reference_id: str
    message: str
    scheduled_for: datetime
    status: NotificationStatus
    sent_at: Optional[datetime]
    failure_reason: Optional[str]
    created_at: datetime
    updated_at: datetime
