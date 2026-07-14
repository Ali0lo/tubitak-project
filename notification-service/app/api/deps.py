"""Shared FastAPI dependencies for the notification-service API layer."""
import uuid
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis, from_url
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import NotificationServiceError
from app.core.security import get_user_id_from_token
from app.db.session import get_db
from app.queue.redis_queue import NotificationQueue
from app.services.notification_service import NotificationService
from app.services.preference_service import PreferenceService

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=False)

_redis_client: Optional[Redis] = None


def get_redis_client() -> Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        bearer_scheme
    ),
) -> uuid.UUID:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        return get_user_id_from_token(credentials.credentials)
    except NotificationServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc


async def get_notification_queue() -> NotificationQueue:
    return NotificationQueue(get_redis_client(), settings.NOTIFICATION_QUEUE_KEY)


async def get_notification_service(
    db: AsyncSession = Depends(get_db),
    queue: NotificationQueue = Depends(get_notification_queue),
) -> NotificationService:
    return NotificationService(db, queue)


async def get_preference_service(
    db: AsyncSession = Depends(get_db),
) -> PreferenceService:
    return PreferenceService(db)
