"""Business logic for task management."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.task import Task, TaskPriority, TaskStatus
from app.repositories.task_repository import TaskRepository
from app.schemas.task import TaskCreate, TaskUpdate
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
        offsets = [
            (timedelta(days=1), f"Task '{task.title}' is due in 1 day"),
            (timedelta(hours=1), f"Task '{task.title}' is due in 1 hour"),
            (timedelta(minutes=15), f"Task '{task.title}' is due in 15 minutes"),
        ]

        for delta, msg in offsets:
            remind_at = task.due_date - delta
            # Skip past reminders! (Part 5)
            if remind_at > now:
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

    @staticmethod
    def _assert_owner(task: Task, user_id: uuid.UUID) -> None:
        if task.user_id != user_id:
            raise ForbiddenError("You do not have access to this task")

