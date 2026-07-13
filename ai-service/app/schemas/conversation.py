"""Pydantic schemas for conversation resources."""
import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.message import MessageResponse


class ConversationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: Optional[str]
    created_at: datetime
    updated_at: datetime


class ConversationDetail(ConversationSummary):
    messages: List[MessageResponse] = Field(default_factory=list)


class ConversationUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
