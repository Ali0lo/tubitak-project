"""Chat API route — the primary interface to the AI assistant."""
import uuid

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import (
    get_access_token,
    get_chat_service,
    get_current_user_id,
)
from app.core.exceptions import AIServiceError
from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.message import MessageResponse
from app.services.chat_service import ChatService

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    access_token: str = Depends(get_access_token),
    chat_service: ChatService = Depends(get_chat_service),
) -> ChatResponse:
    try:
        conversation, final_message, tool_messages = await chat_service.send_message(
            user_id, access_token, payload.conversation_id, payload.message
        )
    except AIServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc

    return ChatResponse(
        conversation_id=conversation.id,
        message=MessageResponse.model_validate(final_message),
        tool_messages=[
            MessageResponse.model_validate(m) for m in tool_messages
        ],
    )
