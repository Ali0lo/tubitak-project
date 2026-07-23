"""Repository for EmailVerificationToken."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from app.models.email_verification_token import EmailVerificationToken
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_verification_token import EmailVerificationToken


class EmailVerificationRepository:
    """CRUD operations for email verification tokens."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        *,
        user_id,
        token_hash: str,
        expires_at: datetime,
    ) -> EmailVerificationToken:
        """Create a new verification token."""

        token = EmailVerificationToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )

        self.db.add(token)
        await self.db.flush()
        await self.db.refresh(token)
        return token

    async def get_by_hash(
        self,
        token_hash: str,
    ) -> Optional[EmailVerificationToken]:
        """Return a token by its hash."""

        result = await self.db.execute(
            select(EmailVerificationToken).where(
                EmailVerificationToken.token_hash == token_hash
            )
        )
        return result.scalar_one_or_none()

    async def get_valid_token(
        self,
        token_hash: str,
    ) -> Optional[EmailVerificationToken]:
        """Return a valid (unused & unexpired) token."""

        result = await self.db.execute(
            select(EmailVerificationToken).where(
                EmailVerificationToken.token_hash == token_hash,
                EmailVerificationToken.used.is_(False),
                EmailVerificationToken.expires_at > datetime.utcnow(),
            )
        )

        return result.scalar_one_or_none()

    async def mark_used(
        self,
        token: EmailVerificationToken,
    ) -> EmailVerificationToken:
        """Mark a token as consumed."""

        token.used = True
        await self.db.flush()
        await self.db.refresh(token)
        return token

    async def delete_for_user(self, user_id) -> None:
        """
        Remove all verification tokens belonging to a user.
        Useful after successful verification.
        """

        result = await self.db.execute(
            select(EmailVerificationToken).where(
                EmailVerificationToken.user_id == user_id
            )
        )

        for token in result.scalars():
            await self.db.delete(token
                                 )

        await self.db.flush()