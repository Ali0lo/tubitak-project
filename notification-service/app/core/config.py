"""Application configuration loaded from environment variables."""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the notification-service."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    SERVICE_NAME: str = "notification-service"

    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/3"

    # Must match auth-service's values so end-user access tokens
    # (used by the list-notifications / preferences endpoints) verify
    # here without a network round-trip.
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"

    # Shared secret checked on the internal schedule/cancel endpoints
    # that core-service calls directly (not through the gateway).
    # Prevents an end user from injecting arbitrary notifications for
    # other users even if they can reach this service on the network.
    INTERNAL_SERVICE_API_KEY: str

    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True
    SMTP_FROM_EMAIL: str = "no-reply@todotak.app"
    SMTP_FROM_NAME: str = "Todotak"
    SMTP_TIMEOUT_SECONDS: float = 10.0

    NOTIFICATION_QUEUE_KEY: str = "notifications:dispatch_queue"
    SCHEDULER_POLL_INTERVAL_SECONDS: float = 15.0
    SCHEDULER_BATCH_SIZE: int = 100
    DISPATCH_QUEUE_TIMEOUT_SECONDS: float = 5.0

    AUTH_SERVICE_URL: str = "http://auth-service:8000"
    AUTH_SERVICE_TIMEOUT_SECONDS: float = 5.0

    CORS_ORIGINS: List[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
