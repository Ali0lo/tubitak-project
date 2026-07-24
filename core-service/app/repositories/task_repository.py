"""Data access layer for the Task and TaskTag models."""
import uuid
from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.task import Task, TaskPriority, TaskStatus, TaskTag


class TaskRepository:
    """Encapsulates all database access for Task rows."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(
        self, task_id: uuid.UUID, *, with_tags: bool = True
    ) -> Optional[Task]:
        stmt = select(Task).where(Task.id == task_id)
        if with_tags:
            stmt = stmt.options(selectinload(Task.tags))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        *,
        offset: int,
        limit: int,
        status: Optional[TaskStatus] = None,
        priority: Optional[TaskPriority] = None,
        due_before: Optional[datetime] = None,
        due_after: Optional[datetime] = None,
        tag: Optional[str] = None,
        overdue_only: Optional[bool] = None,
        today_only: Optional[bool] = None,
        upcoming_only: Optional[bool] = None,
        recurring_only: Optional[bool] = None,
        now: Optional[datetime] = None,
    ) -> Tuple[List[Task], int]:
        stmt = select(Task).where(Task.user_id == user_id)
        current_time = now or datetime.now(timezone.utc)

        if status is not None:
            stmt = stmt.where(Task.status == status)
        if priority is not None:
            stmt = stmt.where(Task.priority == priority)
        if due_before is not None:
            stmt = stmt.where(Task.due_date <= due_before)
        if due_after is not None:
            stmt = stmt.where(Task.due_date >= due_after)
        if tag is not None:
            stmt = stmt.join(Task.tags).where(
                TaskTag.name == tag.strip().lower()
            ).distinct()

        if overdue_only:
            stmt = stmt.where(
                Task.due_date.is_not(None),
                Task.due_date < current_time,
                Task.status.not_in([TaskStatus.COMPLETED, TaskStatus.CANCELLED]),
            )
        elif today_only:
            start_of_day = current_time.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_day = current_time.replace(hour=23, minute=59, second=59, microsecond=999999)
            stmt = stmt.where(
                Task.due_date.is_not(None),
                Task.due_date >= start_of_day,
                Task.due_date <= end_of_day,
            )
        elif upcoming_only:
            stmt = stmt.where(
                Task.due_date.is_not(None),
                Task.due_date >= current_time,
                Task.status.not_in([TaskStatus.COMPLETED, TaskStatus.CANCELLED]),
            )

        if recurring_only:
            stmt = stmt.where(Task.is_recurring == True)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = (
            stmt.options(selectinload(Task.tags))
            .order_by(Task.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        items = list(result.unique().scalars().all())
        return items, total

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        title: str,
        description: Optional[str],
        priority: TaskPriority,
        due_date: Optional[datetime],
        tags: List[str],
        is_recurring: bool = False,
        recurrence_rule: Optional[dict] = None,
        recurrence_parent_id: Optional[uuid.UUID] = None,
    ) -> Task:
        task = Task(
            user_id=user_id,
            title=title,
            description=description,
            priority=priority,
            due_date=due_date,
            is_recurring=is_recurring,
            recurrence_rule=recurrence_rule,
            recurrence_parent_id=recurrence_parent_id,
        )
        task.tags = [TaskTag(name=name) for name in tags]
        self.db.add(task)
        await self.db.flush()
        await self.db.refresh(task, attribute_names=["tags"])
        return task

    async def update(
        self,
        task: Task,
        *,
        title: Optional[str] = None,
        description: Optional[str] = None,
        status: Optional[TaskStatus] = None,
        priority: Optional[TaskPriority] = None,
        due_date: Optional[datetime] = None,
        completed_at: Optional[datetime] = None,
        clear_completed_at: bool = False,
        is_recurring: Optional[bool] = None,
        recurrence_rule: Optional[dict] = None,
    ) -> Task:
        if title is not None:
            task.title = title
        if description is not None:
            task.description = description
        if status is not None:
            task.status = status
        if priority is not None:
            task.priority = priority
        if due_date is not None:
            task.due_date = due_date
        if clear_completed_at:
            task.completed_at = None
        elif completed_at is not None:
            task.completed_at = completed_at
        if is_recurring is not None:
            task.is_recurring = is_recurring
        if recurrence_rule is not None:
            task.recurrence_rule = recurrence_rule
        await self.db.flush()
        await self.db.refresh(task, attribute_names=["tags"])
        return task
        await self.db.flush()
        await self.db.refresh(task, attribute_names=["tags"])
        return task

    async def delete(self, task: Task) -> None:
        await self.db.delete(task)
        await self.db.flush()

    async def replace_tags(self, task: Task, tags: List[str]) -> Task:
        task.tags = [TaskTag(name=name) for name in tags]
        await self.db.flush()
        await self.db.refresh(task, attribute_names=["tags"])
        return task
