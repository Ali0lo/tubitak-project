"""Reminder API routes."""
import math
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user_id, get_reminder_service
from app.core.exceptions import CoreServiceError
from app.schemas.common import PageResponse
from app.schemas.reminder import ReminderCreate, ReminderResponse, ReminderUpdate
from app.services.reminder_service import ReminderService

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.post(
    "", response_model=ReminderResponse, status_code=status.HTTP_201_CREATED
)
async def create_reminder(
    payload: ReminderCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    reminder_service: ReminderService = Depends(get_reminder_service),
) -> ReminderResponse:
    try:
        reminder = await reminder_service.create_reminder(user_id, payload)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return ReminderResponse.model_validate(reminder)


@router.get("", response_model=PageResponse[ReminderResponse])
async def list_reminders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    is_sent: Optional[bool] = Query(default=None),
    user_id: uuid.UUID = Depends(get_current_user_id),
    reminder_service: ReminderService = Depends(get_reminder_service),
) -> PageResponse[ReminderResponse]:
    offset = (page - 1) * page_size
    items, total = await reminder_service.list_reminders(
        user_id, offset=offset, limit=page_size, is_sent=is_sent
    )
    return PageResponse[ReminderResponse](
        items=[ReminderResponse.model_validate(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/{reminder_id}", response_model=ReminderResponse)
async def get_reminder(
    reminder_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    reminder_service: ReminderService = Depends(get_reminder_service),
) -> ReminderResponse:
    try:
        reminder = await reminder_service.get_reminder(user_id, reminder_id)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return ReminderResponse.model_validate(reminder)


@router.patch("/{reminder_id}", response_model=ReminderResponse)
async def update_reminder(
    reminder_id: uuid.UUID,
    payload: ReminderUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    reminder_service: ReminderService = Depends(get_reminder_service),
) -> ReminderResponse:
    try:
        reminder = await reminder_service.update_reminder(
            user_id, reminder_id, payload
        )
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return ReminderResponse.model_validate(reminder)


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(
    reminder_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    reminder_service: ReminderService = Depends(get_reminder_service),
) -> None:
    try:
        await reminder_service.delete_reminder(user_id, reminder_id)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
