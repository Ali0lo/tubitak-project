"""Configuration settings for WorkspaceEngine backend."""

from typing import List, Union

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "WorkspaceEngine"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/workspace_engine"
    )

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # S3 / MinIO
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET: str = "workspace-engine-uploads"
    S3_REGION: str = "us-east-1"

    # Security
    JWT_SECRET_KEY: str = "workspace-engine-super-secret-jwt-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ]

    DEBUG: bool = True

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, v: Union[bool, str, int]) -> bool:
        if isinstance(v, str):
            return v.lower() in ("true", "1", "yes", "on", "t")
        return bool(v)


settings = Settings()
