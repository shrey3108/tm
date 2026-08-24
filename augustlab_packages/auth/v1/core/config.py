"""
Application configuration using Pydantic Settings (v2).

Strict configuration:
- Loads only declared environment variables
- Fails fast on misconfiguration
- Safe for production & packages
"""

from pathlib import Path
from uuid import UUID
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central application settings."""

    # ------------------------------------------------------------------
    # Application
    # ------------------------------------------------------------------
    APP_NAME: str = Field(default="AugustLab Auth")
    APP_VERSION: str = Field(default="1.0.0")
    APP_HOST: str = Field(default="127.0.0.1")
    APP_PORT: int = Field(default=8007)
    DEBUG: bool = Field(default=False)

    # ------------------------------------------------------------------
    # Security
    # ------------------------------------------------------------------
    SECRET_KEY: str = Field(default="qFGvpqymuiJymAy1oZyZmDzKAEMXGMQ2wEwu5ocg7Wo=")

    # ------------------------------------------------------------------
    # Database
    # ------------------------------------------------------------------
    DATABASE_URL: str = Field(default="postgresql+asyncpg://postgres:root@localhost:5432/abl")
    DB_HOST: str = Field(default="localhost")
    DB_PORT: int = Field(default=5432)
    DB_USER: str = Field(default="postgres")
    DB_PASSWORD: str = Field(default="root")
    DB_NAME: str = Field(default="abl")
    DB_SCHEMA: str = Field(default="auth")


    FRONTEND_BASE_URL: str = Field(default="http://localhost:3000")
    REDIS_URL: str = Field(default="redis://localhost:6379/0")
    RATE_LIMIT_DEFAULT: str = Field(default="100/minute")
    RATE_LIMIT_LOGIN: str = Field(default="5/minute")
    RATE_LIMIT_REGISTER: str = Field(default="3/minute")
    RATE_LIMIT_OAUTH: str = Field(default="10/minute")
    RATE_LIMIT_PASSWORD_RESET: str = Field(default="3/minute")

    DB_POOL_SIZE: int = Field(default=5)
    DB_MAX_OVERFLOW: int = Field(default=10)
    DB_ECHO: bool = Field(default=False)

    DEFAULT_ORGANIZATION_ID: UUID = Field(
        default=UUID("00000000-0000-0000-0000-000000000001")
    )

    # ------------------------------------------------------------------
    # JWT
    # ------------------------------------------------------------------
    JWT_SECRET: str = Field(default="qFGvpqymuiJymAy1oZyZmDzKAEMXGMQ2wEwu5ocg7Wo=")
    JWT_EXPIRE_SECONDS: int = Field(default=86400)
    JWT_ALGORITHM: str = Field(default="HS256")

    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)

    # ------------------------------------------------------------------
    # Pydantic settings config
    # ------------------------------------------------------------------
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[4] / ".env"),
        env_file_encoding="utf-8",
        extra="allow",
    )


# Singleton
settings = Settings()
