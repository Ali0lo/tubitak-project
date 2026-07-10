"""Data access layer for the User model."""
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserRepository:
    """Encapsulates all database access for User rows."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def create(
        self, *, email: str, hashed_password: str, full_name: str
    ) -> User:
        user = User(
            email=email, hashed_password=hashed_password, full_name=full_name
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def update_password(self, user: User, hashed_password: str) -> User:
        user.hashed_password = hashed_password
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def update_profile(
        self, user: User, *, full_name: Optional[str] = None
    ) -> User:
        if full_name is not None:
            user.full_name = full_name
        await self.db.flush()
        await self.db.refresh(user)
        return user
