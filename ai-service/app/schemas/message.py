"""Pydantic schemas for message resources."""
import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict

from app.models.message import MessageRole


class ToolCallSchema(BaseModel):
    """Mirrors the shape of an OpenAI tool_call entry."""

    id: str
    name: str
    arguments: dict


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    role: MessageRole
    content: Optional[str]
    tool_calls: Optional[List[dict]]
    tool_call_id: Optional[str]
    created_at: datetime
