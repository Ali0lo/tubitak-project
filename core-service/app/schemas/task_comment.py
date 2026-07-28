"""Pydantic schemas for task comments."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TaskCommentCreate(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    author_name: str = Field(default="User", max_length=128)


class TaskCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    task_id: uuid.UUID
    user_id: uuid.UUID
    author_name: str
    message: str
    created_at: datetime
