"""Pydantic schemas for meeting resources."""
import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.models.meeting import MeetingStatus, ParticipantResponseStatus


class ParticipantCreate(BaseModel):
    email: EmailStr
    name: Optional[str] = Field(default=None, max_length=255)


class ParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    name: Optional[str]
    response_status: ParticipantResponseStatus


class MeetingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=10_000)
    location: Optional[str] = Field(default=None, max_length=255)
    start_time: datetime
    end_time: datetime
    participants: List[ParticipantCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_time_range(self) -> "MeetingCreate":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class MeetingUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=10_000)
    location: Optional[str] = Field(default=None, max_length=255)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[MeetingStatus] = None

    @model_validator(mode="after")
    def _validate_time_range(self) -> "MeetingUpdate":
        if (
            self.start_time is not None
            and self.end_time is not None
            and self.end_time <= self.start_time
        ):
            raise ValueError("end_time must be after start_time")
        return self


class MeetingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: Optional[str]
    location: Optional[str]
    start_time: datetime
    end_time: datetime
    status: MeetingStatus
    created_at: datetime
    updated_at: datetime
    participants: List[ParticipantResponse] = Field(default_factory=list)


class ParticipantResponseUpdate(BaseModel):
    response_status: ParticipantResponseStatus
