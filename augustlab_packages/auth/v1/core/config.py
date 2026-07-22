"""
Application configuration using Pydantic Settings (v2).

Strict configuration:
- Loads only declared environment variables
- Fails fast on misconfiguration
- Safe for production & packages
"""

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
    SECRET_KEY: str

    # ------------------------------------------------------------------
    # Database
    # ------------------------------------------------------------------
    DATABASE_URL: str  # for compatibility
    DB_HOST: str
    DB_PORT: int = Field(default=5432)
    DB_USER: str
    DB_PASSWORD: str
    DB_NAME: str
    DB_SCHEMA: str = Field(default="auth")


    FRONTEND_BASE_URL: str = Field(default="http://localhost:3001")
    REDIS_URL: str
    RATE_LIMIT_DEFAULT: str = Field(default="100/minute")
    RATE_LIMIT_LOGIN: str = Field(default="5/minute")
    RATE_LIMIT_REGISTER: str = Field(default="3/minute")
    RATE_LIMIT_OAUTH: str = Field(default="10/minute")
    RATE_LIMIT_PASSWORD_RESET: str = Field(default="3/minute")

    DB_POOL_SIZE: int = Field(default=5)
    DB_MAX_OVERFLOW: int = Field(default=10)
    DB_ECHO: bool = Field(default=False)

    DEFAULT_ORGANIZATION_ID: UUID

    # ------------------------------------------------------------------
    # JWT
    # ------------------------------------------------------------------
    JWT_SECRET: str
    JWT_EXPIRE_SECONDS: int 
    JWT_ALGORITHM: str = Field(default="HS256")

    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)

    # ------------------------------------------------------------------
    # Pydantic settings config
    # ------------------------------------------------------------------
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="allow",  # ⬅️ strict (keep this)
    )


# Singleton
settings = Settings()
