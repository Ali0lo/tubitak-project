from datetime import datetime
from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_verification_token import EmailVerificationToken


class EmailVerificationRepository:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        token: EmailVerificationToken,
    ) -> EmailVerificationToken:

        self.db.add(token)
        await self.db.flush()
        return token

    async def get_by_hash(
        self,
        token_hash: str,
    ) -> Optional[EmailVerificationToken]:

        result = await self.db.execute(
            select(EmailVerificationToken).where(
                EmailVerificationToken.token_hash == token_hash
            )
        )

        return result.scalar_one_or_none()

    async def delete_user_tokens(
        self,
        user_id,
    ):

        await self.db.execute(
            delete(EmailVerificationToken).where(
                EmailVerificationToken.user_id == user_id
            )
        )

    async def delete_expired(self):

        await self.db.execute(
            delete(EmailVerificationToken).where(
                EmailVerificationToken.expires_at < datetime.utcnow()
            )
        )