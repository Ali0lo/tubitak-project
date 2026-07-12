"""Pydantic schemas for reminder resources."""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ReminderCreate(BaseModel):
    remind_at: datetime
    message: Optional[str] = Field(default=None, max_length=512)
    task_id: Optional[uuid.UUID] = None
    meeting_id: Optional[uuid.UUID] = None

    @model_validator(mode="after")
    def _validate_single_link(self) -> "ReminderCreate":
        if self.task_id is not None and self.meeting_id is not None:
            raise ValueError(
                "A reminder can be linked to a task or a meeting, not both"
            )
        return self


class ReminderUpdate(BaseModel):
    remind_at: Optional[datetime] = None
    message: Optional[str] = Field(default=None, max_length=512)


class ReminderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    task_id: Optional[uuid.UUID]
    meeting_id: Optional[uuid.UUID]
    remind_at: datetime
    message: Optional[str]
    is_sent: bool
    created_at: datetime
    updated_at: datetime
