"""Notification preference API routes."""
import uuid

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user_id, get_preference_service
from app.schemas.preference import (
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
)
from app.services.preference_service import PreferenceService

router = APIRouter(prefix="/notifications/preferences", tags=["preferences"])


@router.get("", response_model=NotificationPreferenceResponse)
async def get_preferences(
    user_id: uuid.UUID = Depends(get_current_user_id),
    preference_service: PreferenceService = Depends(get_preference_service),
) -> NotificationPreferenceResponse:
    preference = await preference_service.get_preference(user_id)
    return NotificationPreferenceResponse.model_validate(preference)


@router.patch("", response_model=NotificationPreferenceResponse)
async def update_preferences(
    payload: NotificationPreferenceUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    preference_service: PreferenceService = Depends(get_preference_service),
) -> NotificationPreferenceResponse:
    preference = await preference_service.update_preference(
        user_id, email_enabled=payload.email_enabled
    )
    return NotificationPreferenceResponse.model_validate(preference)
