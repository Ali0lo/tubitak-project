"""Application configuration loaded from environment variables."""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the core-service."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    SERVICE_NAME: str = "core-service"

    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"

    # Must match auth-service's JWT_SECRET_KEY / JWT_ALGORITHM so that
    # access tokens issued by auth-service can be verified here without
    # a network round-trip on every request.
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"

    NOTIFICATION_SERVICE_URL: str = "http://notification-service:8000"
    NOTIFICATION_SERVICE_TIMEOUT_SECONDS: float = 5.0

    # Shared across auth-service, core-service, and notification-service.
    # Sent as X-Internal-Api-Key when calling notification-service's
    # internal schedule/cancel endpoints directly (not through the gateway).
    INTERNAL_SERVICE_API_KEY: str

    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
