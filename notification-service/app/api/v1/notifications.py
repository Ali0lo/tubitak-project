"""Notification API routes.

/schedule and /{source}/{source_reference_id}/cancel are internal —
called directly by core-service, not through the gateway, and guarded
by the shared internal API key rather than a user's access token.

The rest are end-user endpoints, authenticated the same way as every
other service.
"""
import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user_id, get_notification_service
from app.api.internal_deps import verify_internal_api_key
from app.core.exceptions import NotificationServiceError
from app.schemas.common import PageResponse
from app.schemas.notification import (
    NotificationResponse,
    ScheduleNotificationRequest,
)
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post(
    "/schedule",
    response_model=NotificationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_internal_api_key)],
)
async def schedule_notification(
    payload: ScheduleNotificationRequest,
    notification_service: NotificationService = Depends(get_notification_service),
) -> NotificationResponse:
    notification = await notification_service.schedule(payload)
    return NotificationResponse.model_validate(notification)


@router.post(
    "/source/{source}/{source_reference_id}/cancel",
    response_model=NotificationResponse,
    dependencies=[Depends(verify_internal_api_key)],
)
async def cancel_notification(
    source: str,
    source_reference_id: str,
    notification_service: NotificationService = Depends(get_notification_service),
) -> NotificationResponse:
    try:
        notification = await notification_service.cancel(source, source_reference_id)
    except NotificationServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return NotificationResponse.model_validate(notification)


@router.get("", response_model=PageResponse[NotificationResponse])
async def list_notifications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    unread_only: bool = Query(default=False),
    user_id: uuid.UUID = Depends(get_current_user_id),
    notification_service: NotificationService = Depends(get_notification_service),
) -> PageResponse[NotificationResponse]:
    offset = (page - 1) * page_size
    items, total = await notification_service.list_for_user(
        user_id, offset=offset, limit=page_size, unread_only=unread_only
    )
    return PageResponse[NotificationResponse](
        items=[NotificationResponse.model_validate(n) for n in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/unread-count", response_model=dict)
async def get_unread_count(
    user_id: uuid.UUID = Depends(get_current_user_id),
    notification_service: NotificationService = Depends(get_notification_service),
) -> dict:
    count = await notification_service.get_unread_count(user_id)
    return {"unread_count": count}


@router.post("/read-all", response_model=dict)
async def mark_all_as_read(
    user_id: uuid.UUID = Depends(get_current_user_id),
    notification_service: NotificationService = Depends(get_notification_service),
) -> dict:
    updated_count = await notification_service.mark_all_as_read(user_id)
    return {"marked_read": updated_count}


@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    notification_service: NotificationService = Depends(get_notification_service),
) -> NotificationResponse:
    try:
        notification = await notification_service.get_for_user(
            user_id, notification_id
        )
    except NotificationServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return NotificationResponse.model_validate(notification)


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_as_read(
    notification_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    notification_service: NotificationService = Depends(get_notification_service),
) -> NotificationResponse:
    try:
        notification = await notification_service.mark_as_read(
            user_id, notification_id
        )
    except NotificationServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return NotificationResponse.model_validate(notification)

