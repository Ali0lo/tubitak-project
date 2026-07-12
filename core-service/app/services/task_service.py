"""Business logic for task management."""
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.task import Task, TaskPriority, TaskStatus
from app.repositories.task_repository import TaskRepository
from app.schemas.task import TaskCreate, TaskUpdate


class TaskService:
    """Orchestrates task use cases, enforcing ownership rules."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.tasks = TaskRepository(db)

    async def create_task(self, user_id: uuid.UUID, payload: TaskCreate) -> Task:
        task = await self.tasks.create(
            user_id=user_id,
            title=payload.title,
            description=payload.description,
            priority=payload.priority,
            due_date=payload.due_date,
            tags=payload.tags,
        )
        await self.db.commit()
        return task

    async def get_task(self, user_id: uuid.UUID, task_id: uuid.UUID) -> Task:
        task = await self.tasks.get_by_id(task_id)
        if task is None:
            raise NotFoundError("Task")
        self._assert_owner(task, user_id)
        return task

    async def list_tasks(
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
        return await self.tasks.list_for_user(
            user_id,
            offset=offset,
            limit=limit,
            status=status,
            priority=priority,
            due_before=due_before,
            due_after=due_after,
            tag=tag,
        )

    async def update_task(
        self, user_id: uuid.UUID, task_id: uuid.UUID, payload: TaskUpdate
    ) -> Task:
        task = await self.get_task(user_id, task_id)

        completed_at = None
        clear_completed_at = False
        if payload.status == TaskStatus.COMPLETED and task.status != TaskStatus.COMPLETED:
            completed_at = datetime.now(timezone.utc)
        elif payload.status is not None and payload.status != TaskStatus.COMPLETED:
            clear_completed_at = True

        updated = await self.tasks.update(
            task,
            title=payload.title,
            description=payload.description,
            status=payload.status,
            priority=payload.priority,
            due_date=payload.due_date,
            completed_at=completed_at,
            clear_completed_at=clear_completed_at,
        )
        await self.db.commit()
        return updated

    async def replace_tags(
        self, user_id: uuid.UUID, task_id: uuid.UUID, tags: List[str]
    ) -> Task:
        task = await self.get_task(user_id, task_id)
        normalized = sorted({t.strip().lower() for t in tags if t.strip()})
        updated = await self.tasks.replace_tags(task, normalized)
        await self.db.commit()
        return updated

    async def delete_task(self, user_id: uuid.UUID, task_id: uuid.UUID) -> None:
        task = await self.get_task(user_id, task_id)
        await self.tasks.delete(task)
        await self.db.commit()

    @staticmethod
    def _assert_owner(task: Task, user_id: uuid.UUID) -> None:
        if task.user_id != user_id:
            raise ForbiddenError("You do not have access to this task")
