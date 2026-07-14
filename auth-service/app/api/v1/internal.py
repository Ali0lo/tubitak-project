"""Internal, service-to-service-only routes.

Not exposed through the gateway's normal user-facing routes in
practice — callers reach this directly on the internal network and
authenticate with the shared internal API key rather than a user's
access token.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.internal_deps import verify_internal_api_key
from app.db.session import get_db
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserResponse
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(
    prefix="/internal",
    tags=["internal"],
    dependencies=[Depends(verify_internal_api_key)],
)


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user_by_id(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    repository = UserRepository(db)
    user = await repository.get_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return UserResponse.model_validate(user)
