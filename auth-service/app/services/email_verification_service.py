import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from app.models.email_verification_token import EmailVerificationToken


class EmailVerificationService:

    TOKEN_EXPIRATION_HOURS = 24

    @staticmethod
    def generate_token() -> tuple[str, str]:

        token = secrets.token_urlsafe(48)

        token_hash = hashlib.sha256(
            token.encode()
        ).hexdigest()

        return token, token_hash

    @staticmethod
    def expiration():

        return datetime.now(
            timezone.utc
        ) + timedelta(hours=24)

    @staticmethod
    def hash_token(token: str):

        return hashlib.sha256(
            token.encode()
        ).hexdigest()

    async def build_token(
        self,
        user_id,
    ):

        token, token_hash = self.generate_token()

        db_token = EmailVerificationToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=self.expiration(),
        )

        return token, db_token

    @staticmethod
    def is_expired(db_token):

        return (
            db_token.expires_at
            < datetime.now(timezone.utc)
        )