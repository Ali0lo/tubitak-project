"""Shared FastAPI dependencies for the ai-service API layer."""
import uuid
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.core_service_client import CoreServiceClient
from app.clients.openai_client import OpenAIClient
from app.core.exceptions import AIServiceError
from app.core.security import get_user_id_from_token
from app.db.session import get_db
from app.services.chat_service import ChatService
from app.services.conversation_service import ConversationService
from app.tools.executor import ToolExecutor

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        bearer_scheme
    ),
) -> uuid.UUID:
    """Resolve the authenticated user's id from the access token."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        return get_user_id_from_token(credentials.credentials)
    except AIServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc


async def get_access_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        bearer_scheme
    ),
) -> str:
    """Return the raw bearer token, forwarded to core-service by tools."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return credentials.credentials


async def get_conversation_service(
    db: AsyncSession = Depends(get_db),
) -> ConversationService:
    return ConversationService(db)


async def get_chat_service(db: AsyncSession = Depends(get_db)) -> ChatService:
    openai_client = OpenAIClient()
    tool_executor = ToolExecutor(CoreServiceClient())
    return ChatService(db, openai_client, tool_executor)
