"""Shared FastAPI dependencies for the auth-service API layer."""
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthServiceError
from app.db.session import get_db
from app.models.user import User
from app.services.auth_service import AuthService

from app.services.email_verification_service import EmailVerificationService

bearer_scheme = HTTPBearer(auto_error=False)


async def get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    """Provide an AuthService bound to the request-scoped DB session."""
    return AuthService(db)


async def get_email_verification_service(
    db: AsyncSession = Depends(get_db),
) -> EmailVerificationService:
    """Provide an EmailVerificationService bound to the request-scoped DB session."""
    return EmailVerificationService(db)



async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        bearer_scheme
    ),
    auth_service: AuthService = Depends(get_auth_service),
) -> User:
    """Resolve the authenticated user from the Authorization header."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        return await auth_service.get_current_user(credentials.credentials)
    except AuthServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
