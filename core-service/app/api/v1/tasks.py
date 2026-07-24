"""Task API routes."""
import math
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user_id, get_task_service
from app.core.exceptions import CoreServiceError
from app.models.task import Task, TaskPriority, TaskStatus
from app.schemas.common import PageResponse
from app.schemas.task import (
    BulkRescheduleRequest,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
)
from app.services.task_service import TaskService


def format_overdue_duration(diff_seconds: float) -> str:
    seconds = int(abs(diff_seconds))
    if seconds < 60:
        return f"{seconds} seconds overdue"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} minute{'s' if minutes > 1 else ''} overdue"
    hours = minutes // 60
    if hours < 24:
        return f"{hours} hour{'s' if hours > 1 else ''} overdue"
    days = hours // 24
    if days < 30:
        return f"{days} day{'s' if days > 1 else ''} overdue"
    months = days // 30
    return f"{months} month{'s' if months > 1 else ''} overdue"


def serialize_task(task: Task, reminder_meta: Optional[dict] = None) -> TaskResponse:
    response = TaskResponse.model_validate(task)
    now = datetime.now(timezone.utc)

    if task.due_date:
        response.is_due_today = task.due_date.date() == now.date()
        if task.due_date < now and task.status not in {TaskStatus.COMPLETED, TaskStatus.CANCELLED}:
            response.is_overdue = True
            response.overdue_since = task.due_date
            diff = (now - task.due_date).total_seconds()
            response.overdue_duration = format_overdue_duration(diff)
            response.days_overdue = max(1, (now.date() - task.due_date.date()).days)

    if reminder_meta:
        response.next_reminder_at = reminder_meta.get("next_reminder_at")
        response.last_notification_sent = reminder_meta.get("last_notification_sent")

    return response


router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    task_service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    try:
        task = await task_service.create_task(user_id, payload)
        meta = await task_service.get_reminder_metadata([task.id])
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return serialize_task(task, meta.get(task.id))


@router.get("", response_model=PageResponse[TaskResponse])
async def list_tasks(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: Optional[TaskStatus] = Query(default=None, alias="status"),
    priority: Optional[TaskPriority] = Query(default=None),
    due_before: Optional[datetime] = Query(default=None),
    due_after: Optional[datetime] = Query(default=None),
    tag: Optional[str] = Query(default=None),
    overdue: Optional[bool] = Query(default=None),
    today: Optional[bool] = Query(default=None),
    upcoming: Optional[bool] = Query(default=None),
    recurring: Optional[bool] = Query(default=None),
    user_id: uuid.UUID = Depends(get_current_user_id),
    task_service: TaskService = Depends(get_task_service),
) -> PageResponse[TaskResponse]:
    offset = (page - 1) * page_size
    items, total = await task_service.list_tasks(
        user_id,
        offset=offset,
        limit=page_size,
        status=status_filter,
        priority=priority,
        due_before=due_before,
        due_after=due_after,
        tag=tag,
        overdue_only=overdue,
        today_only=today,
        upcoming_only=upcoming,
        recurring_only=recurring,
    )
    meta = await task_service.get_reminder_metadata([t.id for t in items])
    return PageResponse[TaskResponse](
        items=[serialize_task(t, meta.get(t.id)) for t in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.post("/overdue/reschedule", response_model=List[TaskResponse])
async def bulk_reschedule_overdue_tasks(
    payload: BulkRescheduleRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    task_service: TaskService = Depends(get_task_service),
) -> List[TaskResponse]:
    try:
        updated = await task_service.bulk_reschedule_overdue(
            user_id, payload.new_due_date, payload.task_ids
        )
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return [serialize_task(t) for t in updated]


@router.post("/overdue/complete", response_model=List[TaskResponse])
async def bulk_complete_overdue_tasks(
    task_ids: Optional[List[uuid.UUID]] = None,
    user_id: uuid.UUID = Depends(get_current_user_id),
    task_service: TaskService = Depends(get_task_service),
) -> List[TaskResponse]:
    try:
        completed = await task_service.bulk_complete_overdue(user_id, task_ids)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return [serialize_task(t) for t in completed]


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    task_service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    try:
        task = await task_service.get_task(user_id, task_id)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return serialize_task(task)


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    task_service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    try:
        task = await task_service.update_task(user_id, task_id, payload)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return serialize_task(task)


@router.put("/{task_id}/tags", response_model=TaskResponse)
async def replace_task_tags(
    task_id: uuid.UUID,
    tags: List[str],
    user_id: uuid.UUID = Depends(get_current_user_id),
    task_service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    try:
        task = await task_service.replace_tags(user_id, task_id, tags)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return serialize_task(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    task_service: TaskService = Depends(get_task_service),
) -> None:
    try:
        await task_service.delete_task(user_id, task_id)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc

