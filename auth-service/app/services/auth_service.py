"""Core authentication business logic."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import get_settings
from app.core.exceptions import (
    InvalidCredentialsError,
    InvalidTokenError,
    UserAlreadyExistsError,
    UserNotFoundError,
)
from app.models.user import User
from app.repositories.token_repository import TokenRepository
from app.repositories.user_repository import UserRepository
from app.schemas.token import TokenResponse
from app.schemas.user import UserCreate
from app.utils.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)

settings = get_settings()


class AuthService:
    """Orchestrates authentication use cases across repositories."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.tokens = TokenRepository(db)

    async def register(self, payload: UserCreate) -> User:
        existing = await self.users.get_by_email(payload.email)

        if existing is not None:
            raise UserAlreadyExistsError()

        hashed = hash_password(payload.password)

        user = await self.users.create(
            email=payload.email,
            hashed_password=hashed,
            full_name=payload.full_name,
        )

        raw_token = str(uuid.uuid4())

        expires_at = datetime.now(timezone.utc) + timedelta(
            hours=24
        )

        await self.tokens.create_email_verification_token(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=expires_at,
        )

        await self.db.commit()

        # TODO:
        # Publish event for notification-service
        # to send verification email.

        return user
    
    async def login(
        self, email: str, password: str, device_info: Optional[str] = None
    ) -> TokenResponse:
        user = await self.users.get_by_email(email)
        if user is None or not verify_password(password, user.hashed_password):
            raise InvalidCredentialsError()
        if not user.is_active:
            raise InvalidCredentialsError()
        if not user.is_verified:
            raise InvalidCredentialsError(
                "Please verify your email before logging in."
            )
        tokens = await self._issue_tokens(user, device_info=device_info)
        await self.db.commit()
        return tokens

    async def refresh(
        self, refresh_token: str, device_info: Optional[str] = None
    ) -> TokenResponse:
        try:
            payload = decode_token(refresh_token)
        except TokenError as exc:
            raise InvalidTokenError() from exc

        if payload.get("type") != "refresh":
            raise InvalidTokenError()

        jti = payload.get("jti")
        stored = await self.tokens.get_by_jti(jti) if jti else None
        if stored is None or stored.revoked:
            raise InvalidTokenError()
        if stored.expires_at.replace(tzinfo=timezone.utc) < datetime.now(
            timezone.utc
        ):
            raise InvalidTokenError("Refresh token expired")
        if stored.token_hash != hash_token(refresh_token):
            raise InvalidTokenError()

        user = await self.users.get_by_id(stored.user_id)
        if user is None or not user.is_active:
            raise InvalidTokenError()

        # Rotate: revoke the presented token and issue a fresh pair.
        await self.tokens.revoke(stored)
        tokens = await self._issue_tokens(user, device_info=device_info)
        await self.db.commit()
        return tokens

    async def logout(self, refresh_token: str) -> None:
        try:
            payload = decode_token(refresh_token)
        except TokenError:
            return
        jti = payload.get("jti")
        if not jti:
            return
        stored = await self.tokens.get_by_jti(jti)
        if stored is not None and not stored.revoked:
            await self.tokens.revoke(stored)
            await self.db.commit()

    async def request_password_reset(self, email: str) -> None:
        user = await self.users.get_by_email(email)
        if user is None:
            # Do not leak whether the email exists.
            return
        raw_token = str(uuid.uuid4())
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
        )
        await self.tokens.create_password_reset_token(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=expires_at,
        )
        await self.db.commit()
        # NOTE: dispatching the raw_token to the user's email is the
        # responsibility of notification-service, triggered via an event
        # published after commit (see notification-service integration).

    async def confirm_password_reset(self, token: str, new_password: str) -> None:
        token_hash = hash_token(token)
        stored = await self.tokens.get_password_reset_token_by_hash(token_hash)
        if stored is None or stored.used:
            raise InvalidTokenError("Invalid or already used reset token")
        if stored.expires_at.replace(tzinfo=timezone.utc) < datetime.now(
            timezone.utc
        ):
            raise InvalidTokenError("Reset token expired")

        user = await self.users.get_by_id(stored.user_id)
        if user is None:
            raise UserNotFoundError()

        await self.users.update_password(user, hash_password(new_password))
        await self.tokens.mark_password_reset_used(stored)
        await self.tokens.revoke_all_for_user(user.id)
        await self.db.commit()


        async def verify_email(self, token: str) -> None:
        token_hash = hash_token(token)

        verification = (
            await self.tokens.get_email_verification_token_by_hash(
                token_hash
            )
        )

        if verification is None:
            raise InvalidTokenError("Invalid verification token")

        if verification.used:
            raise InvalidTokenError("Verification token already used")

        if verification.expires_at.replace(
            tzinfo=timezone.utc
        ) < datetime.now(timezone.utc):
            raise InvalidTokenError("Verification token expired")

        user = await self.users.get_by_id(verification.user_id)

        if user is None:
            raise UserNotFoundError()

        user.is_verified = True

        await self.tokens.mark_email_verification_used(
            verification
        )

        await self.db.commit()

        async def resend_verification_email(self, email: str) -> None:
        user = await self.users.get_by_email(email)

        if user is None:
            return

        if user.is_verified:
            return

        raw_token = str(uuid.uuid4())

        expires_at = datetime.now(timezone.utc) + timedelta(
            hours=24
        )

        await self.tokens.create_email_verification_token(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=expires_at,
        )

        await self.db.commit()

        # TODO:
        # Publish event for notification-service to send
        # verification email containing raw_token.

    async def get_current_user(self, access_token: str) -> User:
        try:
            payload = decode_token(access_token)
        except TokenError as exc:
            raise InvalidTokenError() from exc
        if payload.get("type") != "access":
            raise InvalidTokenError()
        user_id = payload.get("sub")
        if not user_id:
            raise InvalidTokenError()
        user = await self.users.get_by_id(uuid.UUID(user_id))
        if user is None or not user.is_active:
            raise InvalidTokenError()
        return user

    async def _issue_tokens(
        self, user: User, device_info: Optional[str]
    ) -> TokenResponse:
        access_token = create_access_token(subject=str(user.id))
        refresh_token, jti, expires_at = create_refresh_token(
            subject=str(user.id)
        )
        await self.tokens.create_refresh_token(
            user_id=user.id,
            token_hash=hash_token(refresh_token),
            jti=jti,
            expires_at=expires_at,
            device_info=device_info,
        )
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
