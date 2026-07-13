"""Application configuration loaded from environment variables."""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the gateway."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    SERVICE_NAME: str = "gateway"

    AUTH_SERVICE_URL: str = "http://auth-service:8000"
    CORE_SERVICE_URL: str = "http://core-service:8000"
    AI_SERVICE_URL: str = "http://ai-service:8000"
    NOTIFICATION_SERVICE_URL: str = "http://notification-service:8000"

    REDIS_URL: str = "redis://localhost:6379/1"

    REQUEST_TIMEOUT_SECONDS: float = 30.0

    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    CORS_ORIGINS: List[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
