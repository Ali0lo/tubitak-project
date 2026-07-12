"""Meeting API routes."""
import math
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user_id, get_meeting_service
from app.core.exceptions import CoreServiceError
from app.models.meeting import MeetingStatus
from app.schemas.common import PageResponse
from app.schemas.meeting import (
    MeetingCreate,
    MeetingResponse,
    MeetingUpdate,
    ParticipantResponseUpdate,
)
from app.services.meeting_service import MeetingService

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
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return MeetingResponse.model_validate(meeting)


@router.get("", response_model=PageResponse[MeetingResponse])
async def list_meetings(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: Optional[MeetingStatus] = Query(default=None, alias="status"),
    starts_after: Optional[datetime] = Query(default=None),
    starts_before: Optional[datetime] = Query(default=None),
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
    )
    return PageResponse[MeetingResponse](
        items=[MeetingResponse.model_validate(m) for m in items],
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
    return MeetingResponse.model_validate(meeting)


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
    return MeetingResponse.model_validate(meeting)


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
    return MeetingResponse.model_validate(meeting)


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
    return MeetingResponse.model_validate(meeting)
