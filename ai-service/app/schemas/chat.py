"""Pydantic schemas for the chat endpoint."""

import uuid
from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.message import MessageResponse


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8_000)
    conversation_id: Optional[uuid.UUID] = None
    user_local_time: Optional[str] = None
    user_timezone: Optional[str] = None


class ChatResponse(BaseModel):
    conversation_id: uuid.UUID
    message: MessageResponse
    tool_messages: List[MessageResponse] = Field(default_factory=list)


class AIConfigResponse(BaseModel):
    provider: str = Field(
        description="Active LLM provider (openai, ollama, vllm, local)"
    )
    model: str = Field(description="Configured active model name")
    is_local: bool = Field(description="Whether a local inference engine is being used")
    base_url: Optional[str] = Field(
        None, description="Base API URL for the model provider"
    )
    tool_calling_supported: bool = Field(
        description="Whether tool calling is enabled/supported"
    )
    fallback_enabled: bool = Field(description="Whether fallback to OpenAI is enabled")
