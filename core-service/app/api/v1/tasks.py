"""Task API routes."""
import math
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user_id, get_task_service
from app.core.exceptions import CoreServiceError
from app.models.task import TaskPriority, TaskStatus
from app.schemas.common import PageResponse
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    task_service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    try:
        task = await task_service.create_task(user_id, payload)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return TaskResponse.model_validate(task)


@router.get("", response_model=PageResponse[TaskResponse])
async def list_tasks(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: Optional[TaskStatus] = Query(default=None, alias="status"),
    priority: Optional[TaskPriority] = Query(default=None),
    due_before: Optional[datetime] = Query(default=None),
    due_after: Optional[datetime] = Query(default=None),
    tag: Optional[str] = Query(default=None),
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
    )
    return PageResponse[TaskResponse](
        items=[TaskResponse.model_validate(t) for t in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


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
    return TaskResponse.model_validate(task)


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
    return TaskResponse.model_validate(task)


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
    return TaskResponse.model_validate(task)


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
