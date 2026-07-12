"""Pydantic schemas for task resources."""
import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.task import TaskPriority, TaskStatus


class TaskTagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=10_000)
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: Optional[datetime] = None
    tags: List[str] = Field(default_factory=list)

    @field_validator("tags")
    @classmethod
    def _dedupe_and_validate_tags(cls, tags: List[str]) -> List[str]:
        cleaned = []
        seen = set()
        for tag in tags:
            normalized = tag.strip().lower()
            if not normalized:
                continue
            if len(normalized) > 64:
                raise ValueError("Tag names must be 64 characters or fewer")
            if normalized not in seen:
                seen.add(normalized)
                cleaned.append(normalized)
        return cleaned


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=10_000)
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[datetime] = None


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: Optional[str]
    status: TaskStatus
    priority: TaskPriority
    due_date: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    tags: List[TaskTagResponse] = Field(default_factory=list)


class TaskFilterParams(BaseModel):
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_before: Optional[datetime] = None
    due_after: Optional[datetime] = None
    tag: Optional[str] = None
