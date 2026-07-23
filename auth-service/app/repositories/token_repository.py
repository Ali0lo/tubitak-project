"""Data access layer for RefreshToken, PasswordResetToken and EmailVerificationToken models."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_verification_token import EmailVerificationToken
from app.models.password_reset_token import PasswordResetToken
from app.models.refresh_token import RefreshToken


class TokenRepository:
    """Encapsulates all database access for token rows."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Refresh tokens
    # ------------------------------------------------------------------

    async def create_refresh_token(
        self,
        *,
        user_id: uuid.UUID,
        token_hash: str,
        jti: str,
        expires_at: datetime,
        device_info: Optional[str] = None,
    ) -> RefreshToken:
        token = RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            jti=jti,
            expires_at=expires_at,
            device_info=device_info,
        )
        self.db.add(token)
        await self.db.flush()
        await self.db.refresh(token)
        return token

    async def get_by_jti(self, jti: str) -> Optional[RefreshToken]:
        result = await self.db.execute(
            select(RefreshToken).where(RefreshToken.jti == jti)
        )
        return result.scalar_one_or_none()

    async def revoke(self, token: RefreshToken) -> None:
        token.revoked = True
        await self.db.flush()

    async def revoke_all_for_user(self, user_id: uuid.UUID) -> None:
        await self.db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id)
            .values(revoked=True)
        )
        await self.db.flush()

    # ------------------------------------------------------------------
    # Password reset tokens
    # ------------------------------------------------------------------

    async def create_password_reset_token(
        self,
        *,
        user_id: uuid.UUID,
        token_hash: str,
        expires_at: datetime,
    ) -> PasswordResetToken:
        token = PasswordResetToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        self.db.add(token)
        await self.db.flush()
        await self.db.refresh(token)
        return token

    async def get_password_reset_token_by_hash(
        self,
        token_hash: str,
    ) -> Optional[PasswordResetToken]:
        result = await self.db.execute(
            select(PasswordResetToken).where(
                PasswordResetToken.token_hash == token_hash
            )
        )
        return result.scalar_one_or_none()

    async def mark_password_reset_used(
        self,
        token: PasswordResetToken,
    ) -> None:
        token.used = True
        await self.db.flush()

    # ------------------------------------------------------------------
    # Email verification tokens
    # ------------------------------------------------------------------

    async def create_email_verification_token(
        self,
        *,
        user_id: uuid.UUID,
        token_hash: str,
        expires_at: datetime,
    ) -> EmailVerificationToken:
        token = EmailVerificationToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        self.db.add(token)
        await self.db.flush()
        await self.db.refresh(token)
        return token

    async def get_email_verification_token_by_hash(
        self,
        token_hash: str,
    ) -> Optional[EmailVerificationToken]:
        result = await self.db.execute(
            select(EmailVerificationToken).where(
                EmailVerificationToken.token_hash == token_hash
            )
        )
        return result.scalar_one_or_none()

    async def mark_email_verification_used(
        self,
        token: EmailVerificationToken,
    ) -> None:
        token.used = True
        await self.db.flush()