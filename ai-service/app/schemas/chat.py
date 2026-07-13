"""Pydantic schemas for the chat endpoint."""
import uuid
from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.message import MessageResponse


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8_000)
    conversation_id: Optional[uuid.UUID] = None


class ChatResponse(BaseModel):
    conversation_id: uuid.UUID
    message: MessageResponse
    tool_messages: List[MessageResponse] = Field(default_factory=list)
