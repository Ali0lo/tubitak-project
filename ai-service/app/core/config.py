"""Application configuration loaded from environment variables."""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the ai-service."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    SERVICE_NAME: str = "ai-service"

    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/2"

    # Must match auth-service's values so tokens forwarded through the
    # gateway verify here without a network round-trip.
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"
    OPENAI_TEMPERATURE: float = 0.3
    OPENAI_REQUEST_TIMEOUT_SECONDS: float = 30.0
    MAX_TOOL_ITERATIONS: int = 5

    CORE_SERVICE_URL: str = "http://core-service:8000"
    CORE_SERVICE_TIMEOUT_SECONDS: float = 10.0

    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    MAX_CONVERSATION_HISTORY_MESSAGES: int = 40


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
