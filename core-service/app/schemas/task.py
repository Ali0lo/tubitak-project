"""Pydantic schemas for task resources."""
import enum
import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.task import TaskPriority, TaskStatus


class RecurrenceFrequency(str, enum.Enum):
    NONE = "none"
    DAILY = "daily"
    WEEKDAYS_ONLY = "weekdays_only"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"
    CUSTOM = "custom"


class RecurrenceRule(BaseModel):
    frequency: RecurrenceFrequency = RecurrenceFrequency.NONE
    interval: int = 1
    unit: Optional[str] = "days"


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
    is_recurring: bool = False
    recurrence_rule: Optional[RecurrenceRule] = None
    reminder_offsets: Optional[List[str]] = None  # e.g. ["1d", "1h", "15m"]

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
    is_recurring: Optional[bool] = None
    recurrence_rule: Optional[RecurrenceRule] = None
    recurrence_scope: Optional[str] = "this_only"  # "this_only", "future", "all"


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
    is_recurring: bool = False
    recurrence_rule: Optional[dict] = None
    recurrence_parent_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime
    tags: List[TaskTagResponse] = Field(default_factory=list)

    # Computed fields
    is_overdue: bool = False
    overdue_since: Optional[datetime] = None
    overdue_duration: Optional[str] = None
    days_overdue: Optional[int] = None
    is_due_today: bool = False
    next_reminder_at: Optional[datetime] = None
    last_notification_sent: Optional[datetime] = None


class BulkRescheduleRequest(BaseModel):
    task_ids: Optional[List[uuid.UUID]] = None
    new_due_date: datetime


class BulkCompleteRequest(BaseModel):
    task_ids: Optional[List[uuid.UUID]] = None


class TaskFilterParams(BaseModel):
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_before: Optional[datetime] = None
    due_after: Optional[datetime] = None
    tag: Optional[str] = None
    overdue_only: Optional[bool] = None
    today_only: Optional[bool] = None
    upcoming_only: Optional[bool] = None
    recurring_only: Optional[bool] = None

