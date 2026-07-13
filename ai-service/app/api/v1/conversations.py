"""Conversation API routes."""
import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_conversation_service, get_current_user_id
from app.core.exceptions import AIServiceError
from app.schemas.common import PageResponse
from app.schemas.conversation import (
    ConversationDetail,
    ConversationSummary,
    ConversationUpdate,
)
from app.services.conversation_service import ConversationService

router = APIRouter(prefix="/ai/conversations", tags=["conversations"])


@router.get("", response_model=PageResponse[ConversationSummary])
async def list_conversations(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user_id: uuid.UUID = Depends(get_current_user_id),
    conversation_service: ConversationService = Depends(get_conversation_service),
) -> PageResponse[ConversationSummary]:
    offset = (page - 1) * page_size
    items, total = await conversation_service.list_conversations(
        user_id, offset=offset, limit=page_size
    )
    return PageResponse[ConversationSummary](
        items=[ConversationSummary.model_validate(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    conversation_service: ConversationService = Depends(get_conversation_service),
) -> ConversationDetail:
    try:
        conversation = await conversation_service.get_conversation(
            user_id, conversation_id
        )
    except AIServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return ConversationDetail.model_validate(conversation)


@router.patch("/{conversation_id}", response_model=ConversationSummary)
async def update_conversation(
    conversation_id: uuid.UUID,
    payload: ConversationUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    conversation_service: ConversationService = Depends(get_conversation_service),
) -> ConversationSummary:
    try:
        conversation = await conversation_service.update_conversation(
            user_id, conversation_id, payload
        )
    except AIServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return ConversationSummary.model_validate(conversation)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    conversation_service: ConversationService = Depends(get_conversation_service),
) -> None:
    try:
        await conversation_service.delete_conversation(user_id, conversation_id)
    except AIServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
