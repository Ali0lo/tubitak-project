"""Business logic for email verification."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.email_verification_repository import (
    EmailVerificationRepository,
)
from app.utils.token import TokenUtils


class EmailVerificationService:
    """Handles creation and verification of email verification tokens."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repository = EmailVerificationRepository(db)

    async def create_verification_token(
        self,
        user: User,
    ) -> str:
        """
        Create a new verification token for a user.

        Returns:
            Plain-text token (to send via email).
        """

        # Remove any previous verification tokens
        await self.repository.delete_for_user(user.id)

        token, token_hash = TokenUtils.generate_token_pair()

        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

        await self.repository.create(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )

        await self.db.commit()

        # Send verification token notification via notification-service
        try:
            import logging
            import httpx
            from app.config.settings import get_settings

            logger = logging.getLogger("auth-service.verification")
            settings = get_settings()

            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(
                    f"{settings.NOTIFICATION_SERVICE_URL}/api/v1/notifications/schedule",
                    headers={"X-Internal-API-Key": settings.INTERNAL_SERVICE_API_KEY},
                    json={
                        "source": "auth",
                        "source_reference_id": f"email-verify-{user.id}-{int(datetime.now(timezone.utc).timestamp())}",
                        "user_id": str(user.id),
                        "scheduled_for": datetime.now(timezone.utc).isoformat(),
                        "message": f"Welcome to Todotak! Your email verification token is: {token}",
                    },
                )
        except Exception as exc:
            import logging
            logging.getLogger("auth-service.verification").warning(
                "Failed to dispatch verification email notification: %s", exc
            )

        return token

    async def verify_email(
        self,
        token: str,
    ) -> User:
        """
        Verify a user's email using the received token.

        Raises:
            ValueError if token is invalid or expired.
        """

        clean_token = token.strip()
        token_hash = TokenUtils.hash_token(clean_token)

        verification = await self.repository.get_valid_token(token_hash)

        if verification is None:
            raise ValueError("Invalid or expired verification token.")

        user = verification.user
        if user is None:
            raise ValueError("User associated with verification token was not found.")

        if user.is_verified:
            return user

        user.is_verified = True

        await self.repository.mark_used(verification)
        await self.repository.delete_for_user(user.id)

        await self.db.commit()
        await self.db.refresh(user)

        return user

    async def resend_verification(
        self,
        user: User,
    ) -> str:
        """
        Generate a brand-new verification token.
        """
        return await self.create_verification_token(user)