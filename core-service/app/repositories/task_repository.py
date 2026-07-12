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
    ) -> Tuple[List[Task], int]:
        stmt = select(Task).where(Task.user_id == user_id)

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
    ) -> Task:
        task = Task(
            user_id=user_id,
            title=title,
            description=description,
            priority=priority,
            due_date=due_date,
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
