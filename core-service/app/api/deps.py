"""Shared FastAPI dependencies for the core-service API layer."""
import uuid
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import CoreServiceError
from app.core.security import get_user_id_from_token
from app.db.session import get_db
from app.services.meeting_service import MeetingService
from app.services.reminder_service import ReminderService
from app.services.task_service import TaskService

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        bearer_scheme
    ),
) -> uuid.UUID:
    """Resolve the authenticated user's id from the access token.

    core-service trusts the JWT signature (shared secret with
    auth-service) rather than calling auth-service on every request.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        return get_user_id_from_token(credentials.credentials)
    except CoreServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc


async def get_task_service(db: AsyncSession = Depends(get_db)) -> TaskService:
    return TaskService(db)


async def get_meeting_service(
    db: AsyncSession = Depends(get_db),
) -> MeetingService:
    return MeetingService(db)


async def get_reminder_service(
    db: AsyncSession = Depends(get_db),
) -> ReminderService:
    return ReminderService(db)
