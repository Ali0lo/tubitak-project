"""Meeting API routes."""
import math
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user_id, get_meeting_service
from app.core.exceptions import CoreServiceError
from app.models.meeting import Meeting, MeetingStatus
from app.schemas.common import PageResponse
from app.schemas.meeting import (
    MeetingCreate,
    MeetingResponse,
    MeetingUpdate,
    ParticipantResponseUpdate,
)
from app.services.meeting_service import MeetingService


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


def serialize_meeting(meeting: Meeting, reminder_meta: Optional[dict] = None) -> MeetingResponse:
    response = MeetingResponse.model_validate(meeting)
    now = datetime.now(timezone.utc)

    if meeting.end_time < now and meeting.status not in {MeetingStatus.COMPLETED, MeetingStatus.CANCELLED}:
        response.is_overdue = True
        response.overdue_since = meeting.end_time
        diff = (now - meeting.end_time).total_seconds()
        response.overdue_duration = format_overdue_duration(diff)

    if reminder_meta:
        response.next_reminder_at = reminder_meta.get("next_reminder_at")
        response.last_notification_sent = reminder_meta.get("last_notification_sent")

    return response


router = APIRouter(prefix="/meetings", tags=["meetings"])


@router.post(
    "", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED
)
async def create_meeting(
    payload: MeetingCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    meeting_service: MeetingService = Depends(get_meeting_service),
) -> MeetingResponse:
    try:
        meeting = await meeting_service.create_meeting(user_id, payload)
        meta = await meeting_service.get_reminder_metadata([meeting.id])
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return serialize_meeting(meeting, meta.get(meeting.id))


@router.get("", response_model=PageResponse[MeetingResponse])
async def list_meetings(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: Optional[MeetingStatus] = Query(default=None, alias="status"),
    starts_after: Optional[datetime] = Query(default=None),
    starts_before: Optional[datetime] = Query(default=None),
    overdue: Optional[bool] = Query(default=None),
    missed: Optional[bool] = Query(default=None),
    today: Optional[bool] = Query(default=None),
    upcoming: Optional[bool] = Query(default=None),
    user_id: uuid.UUID = Depends(get_current_user_id),
    meeting_service: MeetingService = Depends(get_meeting_service),
) -> PageResponse[MeetingResponse]:
    offset = (page - 1) * page_size
    items, total = await meeting_service.list_meetings(
        user_id,
        offset=offset,
        limit=page_size,
        status=status_filter,
        starts_after=starts_after,
        starts_before=starts_before,
        overdue_only=overdue,
        missed_only=missed,
        today_only=today,
        upcoming_only=upcoming,
    )
    meta = await meeting_service.get_reminder_metadata([m.id for m in items])
    return PageResponse[MeetingResponse](
        items=[serialize_meeting(m, meta.get(m.id)) for m in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    meeting_service: MeetingService = Depends(get_meeting_service),
) -> MeetingResponse:
    try:
        meeting = await meeting_service.get_meeting(user_id, meeting_id)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return serialize_meeting(meeting)


@router.patch("/{meeting_id}", response_model=MeetingResponse)
async def update_meeting(
    meeting_id: uuid.UUID,
    payload: MeetingUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    meeting_service: MeetingService = Depends(get_meeting_service),
) -> MeetingResponse:
    try:
        meeting = await meeting_service.update_meeting(user_id, meeting_id, payload)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return serialize_meeting(meeting)


@router.post("/{meeting_id}/cancel", response_model=MeetingResponse)
async def cancel_meeting(
    meeting_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    meeting_service: MeetingService = Depends(get_meeting_service),
) -> MeetingResponse:
    try:
        meeting = await meeting_service.cancel_meeting(user_id, meeting_id)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return serialize_meeting(meeting)


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(
    meeting_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    meeting_service: MeetingService = Depends(get_meeting_service),
) -> None:
    try:
        await meeting_service.delete_meeting(user_id, meeting_id)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc


@router.patch(
    "/{meeting_id}/participants/{participant_id}",
    response_model=MeetingResponse,
)
async def update_participant_response(
    meeting_id: uuid.UUID,
    participant_id: uuid.UUID,
    payload: ParticipantResponseUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    meeting_service: MeetingService = Depends(get_meeting_service),
) -> MeetingResponse:
    try:
        meeting = await meeting_service.update_participant_response(
            user_id, meeting_id, participant_id, payload.response_status
        )
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return serialize_meeting(meeting)

