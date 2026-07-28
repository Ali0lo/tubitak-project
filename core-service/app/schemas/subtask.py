"""Pydantic schemas for subtasks."""
import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class SubtaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    completed: bool = False


class SubtaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    completed: Optional[bool] = None
    position: Optional[int] = None


class SubtaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    task_id: uuid.UUID
    title: str
    completed: bool
    position: int
    created_at: datetime
    updated_at: datetime


class SubtaskReorderRequest(BaseModel):
    subtask_ids: List[uuid.UUID]
