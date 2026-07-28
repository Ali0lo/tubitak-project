"""Business logic for task management."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.subtask import Subtask
from app.models.task_activity import TaskActivity
from app.models.task_comment import TaskComment
from app.repositories.task_repository import TaskRepository
from app.schemas.task import TaskCreate, TaskUpdate
from app.schemas.subtask import SubtaskCreate, SubtaskUpdate
from app.schemas.task_comment import TaskCommentCreate
from app.services.reminder_service import ReminderService
from app.schemas.reminder import ReminderCreate


def compute_next_due_date(base_date: Optional[datetime], rule: Optional[dict]) -> Optional[datetime]:
    if not base_date or not rule:
        return None

    freq = rule.get("frequency") if isinstance(rule, dict) else getattr(rule, "frequency", None)
    if hasattr(freq, "value"):
        freq = freq.value
    if not freq or freq == "none":
        return None

    interval = rule.get("interval", 1) if isinstance(rule, dict) else getattr(rule, "interval", 1)
    unit = rule.get("unit", "days") if isinstance(rule, dict) else getattr(rule, "unit", "days")

    if freq == "daily":
        return base_date + timedelta(days=1)
    elif freq == "weekdays_only":
        next_date = base_date + timedelta(days=1)
        while next_date.weekday() in (5, 6):  # Saturday=5, Sunday=6
            next_date += timedelta(days=1)
        return next_date
    elif freq == "weekly":
        return base_date + timedelta(weeks=1)
    elif freq == "biweekly":
        return base_date + timedelta(weeks=2)
    elif freq == "monthly":
        year = base_date.year + (base_date.month // 12)
        month = (base_date.month % 12) + 1
        day = min(base_date.day, 28)
        return base_date.replace(year=year, month=month, day=day)
    elif freq == "yearly":
        return base_date.replace(year=base_date.year + 1)
    elif freq == "custom":
        if unit in ("days", "day"):
            return base_date + timedelta(days=interval)
        elif unit in ("weeks", "week"):
            return base_date + timedelta(weeks=interval)
        elif unit in ("months", "month"):
            month_idx = base_date.month + interval - 1
            year = base_date.year + (month_idx // 12)
            month = (month_idx % 12) + 1
            day = min(base_date.day, 28)
            return base_date.replace(year=year, month=month, day=day)
        elif unit in ("years", "year"):
            return base_date.replace(year=base_date.year + interval)
        return base_date + timedelta(days=interval)

    return None


class TaskService:
    """Orchestrates task use cases, enforcing ownership rules."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.tasks = TaskRepository(db)
        self.reminder_service = ReminderService(db)

    async def get_reminder_metadata(self, task_ids: List[uuid.UUID]) -> dict:
        now = datetime.now(timezone.utc)
        return await self.reminder_service.reminders.get_task_reminder_metadata(task_ids, now)

    async def create_task(self, user_id: uuid.UUID, payload: TaskCreate) -> Task:
        recurrence_dict = None
        if payload.is_recurring and payload.recurrence_rule:
            recurrence_dict = (
                payload.recurrence_rule.model_dump()
                if hasattr(payload.recurrence_rule, "model_dump")
                else dict(payload.recurrence_rule)
            )

        task = await self.tasks.create(
            user_id=user_id,
            title=payload.title,
            description=payload.description,
            priority=payload.priority,
            due_date=payload.due_date,
            tags=payload.tags,
            is_recurring=payload.is_recurring,
            recurrence_rule=recurrence_dict,
        )
        await self.db.commit()

        # Schedule default task reminders (1 day, 1 hour, 15 minutes before due date)
        if task.due_date:
            await self._schedule_default_task_reminders(user_id, task)

        return task

    async def _schedule_default_task_reminders(self, user_id: uuid.UUID, task: Task) -> None:
        if not task.due_date:
            return

        now = datetime.now(timezone.utc)
        due_date = task.due_date
        if due_date.tzinfo is None:
            due_date = due_date.replace(tzinfo=timezone.utc)
        else:
            due_date = due_date.astimezone(timezone.utc)

        offsets = [
            (timedelta(days=1), f"Task '{task.title}' is due in 1 day"),
            (timedelta(hours=1), f"Task '{task.title}' is due in 1 hour"),
            (timedelta(minutes=15), f"Task '{task.title}' is due in 15 minutes"),
            (timedelta(seconds=0), f"Task '{task.title}' is due now"),
        ]

        for delta, msg in offsets:
            remind_at = due_date - delta
            if remind_at >= now:
                try:
                    await self.reminder_service.create_reminder(
                        user_id=user_id,
                        payload=ReminderCreate(
                            task_id=task.id,
                            remind_at=remind_at,
                            message=msg,
                        ),
                    )
                except Exception:
                    pass  # Non-fatal if reminder fail
            elif delta == timedelta(seconds=0) and abs((now - due_date).total_seconds()) < 300:
                try:
                    await self.reminder_service.create_reminder(
                        user_id=user_id,
                        payload=ReminderCreate(
                            task_id=task.id,
                            remind_at=now,
                            message=msg,
                        ),
                    )
                except Exception:
                    pass


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
        overdue_only: Optional[bool] = None,
        today_only: Optional[bool] = None,
        upcoming_only: Optional[bool] = None,
        recurring_only: Optional[bool] = None,
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
            overdue_only=overdue_only,
            today_only=today_only,
            upcoming_only=upcoming_only,
            recurring_only=recurring_only,
        )

    async def update_task(
        self, user_id: uuid.UUID, task_id: uuid.UUID, payload: TaskUpdate
    ) -> Task:
        task = await self.get_task(user_id, task_id)

        completed_at = None
        clear_completed_at = False
        is_becoming_completed = False

        if payload.status == TaskStatus.COMPLETED and task.status != TaskStatus.COMPLETED:
            completed_at = datetime.now(timezone.utc)
            is_becoming_completed = True
        elif payload.status is not None and payload.status != TaskStatus.COMPLETED:
            clear_completed_at = True

        recurrence_dict = None
        if payload.recurrence_rule is not None:
            recurrence_dict = (
                payload.recurrence_rule.model_dump()
                if hasattr(payload.recurrence_rule, "model_dump")
                else dict(payload.recurrence_rule)
            )

        due_date_changed = payload.due_date is not None and payload.due_date != task.due_date

        updated = await self.tasks.update(
            task,
            title=payload.title,
            description=payload.description,
            status=payload.status,
            priority=payload.priority,
            due_date=payload.due_date,
            completed_at=completed_at,
            clear_completed_at=clear_completed_at,
            is_recurring=payload.is_recurring,
            recurrence_rule=recurrence_dict,
        )
        await self.db.commit()

        if due_date_changed and updated.due_date:
            await self._schedule_default_task_reminders(user_id, updated)

        # Handle Recurring Task completion (Part 7)
        if is_becoming_completed and updated.is_recurring and updated.recurrence_rule:
            next_due = compute_next_due_date(updated.due_date or datetime.now(timezone.utc), updated.recurrence_rule)
            if next_due:
                tag_names = [t.name for t in updated.tags]
                next_task = await self.tasks.create(
                    user_id=user_id,
                    title=updated.title,
                    description=updated.description,
                    priority=updated.priority,
                    due_date=next_due,
                    tags=tag_names,
                    is_recurring=True,
                    recurrence_rule=updated.recurrence_rule,
                    recurrence_parent_id=updated.recurrence_parent_id or updated.id,
                )
                await self.db.commit()
                await self._schedule_default_task_reminders(user_id, next_task)

        return updated

    async def bulk_reschedule_overdue(
        self, user_id: uuid.UUID, new_due_date: datetime, task_ids: Optional[List[uuid.UUID]] = None
    ) -> List[Task]:
        now = datetime.now(timezone.utc)
        if task_ids:
            tasks_to_update = []
            for tid in task_ids:
                try:
                    t = await self.get_task(user_id, tid)
                    if t.status not in (TaskStatus.COMPLETED, TaskStatus.CANCELLED):
                        tasks_to_update.append(t)
                except NotFoundError:
                    pass
        else:
            tasks_to_update, _ = await self.tasks.list_for_user(
                user_id, offset=0, limit=500, overdue_only=True, now=now
            )

        updated_list = []
        for task in tasks_to_update:
            updated = await self.tasks.update(task, due_date=new_due_date)
            await self._schedule_default_task_reminders(user_id, updated)
            updated_list.append(updated)

        await self.db.commit()
        return updated_list

    async def bulk_complete_overdue(
        self, user_id: uuid.UUID, task_ids: Optional[List[uuid.UUID]] = None
    ) -> List[Task]:
        now = datetime.now(timezone.utc)
        if task_ids:
            tasks_to_update = []
            for tid in task_ids:
                try:
                    t = await self.get_task(user_id, tid)
                    if t.status not in (TaskStatus.COMPLETED, TaskStatus.CANCELLED):
                        tasks_to_update.append(t)
                except NotFoundError:
                    pass
        else:
            tasks_to_update, _ = await self.tasks.list_for_user(
                user_id, offset=0, limit=500, overdue_only=True, now=now
            )

        completed_list = []
        for task in tasks_to_update:
            updated = await self.update_task(
                user_id, task.id, TaskUpdate(status=TaskStatus.COMPLETED)
            )
            completed_list.append(updated)

        return completed_list

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

    async def log_activity(
        self, task_id: uuid.UUID, user_id: uuid.UUID, action: str, details: Optional[str] = None
    ) -> TaskActivity:
        activity = TaskActivity(
            task_id=task_id,
            user_id=user_id,
            action=action,
            details=details,
        )
        self.db.add(activity)
        return activity

    async def get_activities(self, user_id: uuid.UUID, task_id: uuid.UUID) -> List[TaskActivity]:
        await self.get_task(user_id, task_id)
        stmt = (
            select(TaskActivity)
            .where(TaskActivity.task_id == task_id)
            .order_by(TaskActivity.created_at.desc())
        )
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    # Subtasks
    async def list_subtasks(self, user_id: uuid.UUID, task_id: uuid.UUID) -> List[Subtask]:
        await self.get_task(user_id, task_id)
        stmt = (
            select(Subtask)
            .where(Subtask.task_id == task_id)
            .order_by(Subtask.position.asc(), Subtask.created_at.asc())
        )
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def create_subtask(
        self, user_id: uuid.UUID, task_id: uuid.UUID, payload: SubtaskCreate
    ) -> Subtask:
        await self.get_task(user_id, task_id)
        existing = await self.list_subtasks(user_id, task_id)
        max_pos = max([s.position for s in existing], default=-1)

        subtask = Subtask(
            task_id=task_id,
            title=payload.title,
            completed=payload.completed,
            position=max_pos + 1,
        )
        self.db.add(subtask)
        await self.log_activity(task_id, user_id, "subtask_added", f"Added subtask '{payload.title}'")
        await self.db.commit()
        await self.db.refresh(subtask)
        return subtask

    async def update_subtask(
        self, user_id: uuid.UUID, task_id: uuid.UUID, subtask_id: uuid.UUID, payload: SubtaskUpdate
    ) -> Subtask:
        await self.get_task(user_id, task_id)
        stmt = select(Subtask).where(Subtask.id == subtask_id, Subtask.task_id == task_id)
        res = await self.db.execute(stmt)
        subtask = res.scalar_one_or_none()
        if not subtask:
            raise NotFoundError("Subtask not found")

        if payload.title is not None:
            subtask.title = payload.title
        if payload.completed is not None and payload.completed != subtask.completed:
            subtask.completed = payload.completed
            action = "subtask_completed" if payload.completed else "subtask_uncompleted"
            await self.log_activity(task_id, user_id, action, f"Subtask '{subtask.title}' updated")
        if payload.position is not None:
            subtask.position = payload.position

        await self.db.commit()
        await self.db.refresh(subtask)
        return subtask

    async def delete_subtask(
        self, user_id: uuid.UUID, task_id: uuid.UUID, subtask_id: uuid.UUID
    ) -> None:
        await self.get_task(user_id, task_id)
        stmt = select(Subtask).where(Subtask.id == subtask_id, Subtask.task_id == task_id)
        res = await self.db.execute(stmt)
        subtask = res.scalar_one_or_none()
        if not subtask:
            raise NotFoundError("Subtask not found")

        await self.db.delete(subtask)
        await self.log_activity(task_id, user_id, "subtask_deleted", f"Deleted subtask '{subtask.title}'")
        await self.db.commit()

    async def reorder_subtasks(
        self, user_id: uuid.UUID, task_id: uuid.UUID, subtask_ids: List[uuid.UUID]
    ) -> List[Subtask]:
        existing = await self.list_subtasks(user_id, task_id)
        subtask_map = {s.id: s for s in existing}
        for index, sid in enumerate(subtask_ids):
            if sid in subtask_map:
                subtask_map[sid].position = index
        await self.db.commit()
        return await self.list_subtasks(user_id, task_id)

    # Comments
    async def list_comments(self, user_id: uuid.UUID, task_id: uuid.UUID) -> List[TaskComment]:
        await self.get_task(user_id, task_id)
        stmt = (
            select(TaskComment)
            .where(TaskComment.task_id == task_id)
            .order_by(TaskComment.created_at.asc())
        )
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def create_comment(
        self, user_id: uuid.UUID, task_id: uuid.UUID, payload: TaskCommentCreate
    ) -> TaskComment:
        await self.get_task(user_id, task_id)
        comment = TaskComment(
            task_id=task_id,
            user_id=user_id,
            author_name=payload.author_name,
            message=payload.message,
        )
        self.db.add(comment)
        await self.log_activity(task_id, user_id, "comment_added", f"Added a comment")
        await self.db.commit()
        await self.db.refresh(comment)
        return comment

    @staticmethod
    def _assert_owner(task: Task, user_id: uuid.UUID) -> None:
        if task.user_id != user_id:
            raise ForbiddenError("You do not have access to this task")


