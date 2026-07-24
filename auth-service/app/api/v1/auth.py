"""Authentication API routes."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.api.deps import (
    get_auth_service,
    get_current_user,
    get_email_verification_service,
)
from app.config.settings import get_settings
from app.core.exceptions import AuthServiceError
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RefreshRequest,
    ResendVerificationRequest,
    VerifyEmailRequest,
)
from app.schemas.token import TokenResponse
from app.schemas.user import UserCreate, UserResponse
from app.services.auth_service import AuthService
from app.services.email_verification_service import EmailVerificationService

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_PATH = "/api/v1/auth"


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.ENVIRONMENT != "development",
        samesite="strict",
        path=REFRESH_COOKIE_PATH,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    payload: UserCreate,
    auth_service: AuthService = Depends(get_auth_service),
    verification_service: EmailVerificationService = Depends(
        get_email_verification_service
    ),
) -> UserResponse:
    try:
        user = await auth_service.register(payload)
        # Create initial email verification token
        await verification_service.create_verification_token(user)
    except AuthServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return UserResponse.model_validate(user)


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    try:
        tokens = await auth_service.login(
            payload.email,
            payload.password,
            device_info=request.headers.get("user-agent"),
        )
    except AuthServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    _set_refresh_cookie(response, tokens.refresh_token)
    return tokens


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,
    response: Response,
    payload: Optional[RefreshRequest] = None,
    auth_service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    token = (payload.refresh_token if payload else None) or request.cookies.get(
        REFRESH_COOKIE_NAME
    )
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )
    try:
        tokens = await auth_service.refresh(
            token, device_info=request.headers.get("user-agent")
        )
    except AuthServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    _set_refresh_cookie(response, tokens.refresh_token)
    return tokens


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    payload: Optional[RefreshRequest] = None,
    auth_service: AuthService = Depends(get_auth_service),
) -> None:
    token = (payload.refresh_token if payload else None) or request.cookies.get(
        REFRESH_COOKIE_NAME
    )
    if token:
        await auth_service.logout(token)
    response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)


@router.get("/me", response_model=UserResponse)
async def read_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.post("/verify-email", response_model=UserResponse)
async def verify_email(
    payload: VerifyEmailRequest,
    verification_service: EmailVerificationService = Depends(
        get_email_verification_service
    ),
) -> UserResponse:
    try:
        user = await verification_service.verify_email(payload.token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    return UserResponse.model_validate(user)


@router.post("/resend-verification", status_code=status.HTTP_200_OK)
async def resend_verification(
    payload: ResendVerificationRequest,
    auth_service: AuthService = Depends(get_auth_service),
    verification_service: EmailVerificationService = Depends(
        get_email_verification_service
    ),
) -> dict[str, str]:
    user = await auth_service.users.get_by_email(payload.email)
    if user and not user.is_verified:
        await verification_service.resend_verification(user)
    return {"message": "If the email is unverified, a verification token has been generated"}


@router.post("/password-reset/request", status_code=status.HTTP_202_ACCEPTED)
async def request_password_reset(
    payload: PasswordResetRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> dict[str, str]:
    await auth_service.request_password_reset(payload.email)
    return {"message": "If the email exists, a reset link has been sent"}


@router.post("/password-reset/confirm", status_code=status.HTTP_200_OK)
async def confirm_password_reset(
    payload: PasswordResetConfirm,
    auth_service: AuthService = Depends(get_auth_service),
) -> dict[str, str]:
    try:
        await auth_service.confirm_password_reset(
            payload.token, payload.new_password
        )
    except AuthServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=exc.message
        ) from exc
    return {"message": "Password has been reset successfully"}

