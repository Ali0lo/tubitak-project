"""Application configuration loaded from environment variables."""

from functools import lru_cache
from typing import Any, List, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the ai-service."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    SERVICE_NAME: str = "ai-service"

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, v: Any) -> bool:
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower() in ("true", "1", "t", "yes", "y")
        return bool(v)

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

    # Local LLM (Ollama / vLLM) & Provider Routing Configuration
    LLM_PROVIDER: str = "auto"  # auto | openai | local | ollama | vllm
    LOCAL_LLM_URL: Optional[str] = None
    LOCAL_LLM_MODEL: str = "llama3.1"
    LOCAL_LLM_API_KEY: str = "ollama"
    FALLBACK_TO_OPENAI: bool = True

    @field_validator("LOCAL_LLM_URL", mode="before")
    @classmethod
    def normalize_local_llm_url(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        if isinstance(v, str):
            v_str = v.strip()
            if not v_str:
                return None
            v_str = v_str.rstrip("/")
            if not v_str.endswith("/v1"):
                v_str = f"{v_str}/v1"
            return v_str
        return str(v)

    @field_validator("FALLBACK_TO_OPENAI", mode="before")
    @classmethod
    def parse_fallback_to_openai(cls, v: Any) -> bool:
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower() in ("true", "1", "t", "yes", "y")
        return bool(v)

    CORE_SERVICE_URL: str = "http://core-service:8000"
    CORE_SERVICE_TIMEOUT_SECONDS: float = 10.0

    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    MAX_CONVERSATION_HISTORY_MESSAGES: int = 40


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
