"""
Configuration module.

This module defines the database configuration settings using Pydantic BaseSettings.
Settings are loaded from environment variables and .env files.
"""

from pathlib import Path
from pydantic import computed_field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Database settings loaded from environment variables.

    Attributes:
        POSTGRES_SERVER: PostgreSQL server hostname.
        POSTGRES_PORT: PostgreSQL server port.
        POSTGRES_USER: PostgreSQL username.
        POSTGRES_PASSWORD: PostgreSQL password.
        POSTGRES_DB: PostgreSQL database name.
    """

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env", "../../.env", "../../../.env", "../../../../.env"),
        env_ignore_empty=True,
        extra="ignore",
    )

    # General Configurations
    PROJECT_NAME: str = "GitHub Code Evaluator"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    REPO_ACCESS_GRACE_PERIOD_HOURS: int = 48

    # Postgres Configurations
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5435
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "github_evaluator"

    # Specific database overrides when running alongside another project
    EVALUATOR_POSTGRES_SERVER: str | None = None
    EVALUATOR_POSTGRES_PORT: int | None = None
    EVALUATOR_POSTGRES_USER: str | None = None
    EVALUATOR_POSTGRES_PASSWORD: str | None = None
    EVALUATOR_POSTGRES_DB: str | None = None

    # Redis Configurations
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_TTL: int = 86400

    # Celery Configurations
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    CELERY_WORKER_CONCURRENCY: int = 4
    MAX_QUEUE_DEPTH: int = 10

    # JWT Configurations (RS256 PEM format strings)
    JWT_PUBLIC_KEY: str | None = None
    JWT_PRIVATE_KEY: SecretStr | None = None

    # LLM Configurations
    OPENAI_API_KEY: SecretStr | None = None
    LITELLM_API_KEY: SecretStr | None = None
    LLM_MODEL: str = "gemma4:31b-cloud"
    LLM_MODEL_LOGIC: str = "gpt-oss:120b-cloud"
    LITELLM_BASE_URL: str | None = None

    # SMTP Configurations
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: SecretStr | None = None
    SMTP_FROM_EMAIL: str = "noreply@example.com"
    HR_EMAIL: str = "hr@example.com"

    # Prompt Configurations
    EVALUATION_PROMPT_VERSION: str = "v1"
    EVALUATION_LLM_TIMEOUT: float = 300.0
    EVALUATION_LIGHTWEIGHT_MODE: bool = True

    @model_validator(mode="after")
    def validate_llm_credentials(self) -> "Settings":
        """Ensure API credentials are valid on startup."""
        if not self.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY must be set")
        return self

    @computed_field
    @property
    def database_url(self) -> str:
        """Generate the database URL for SQLAlchemy.

        Returns:
            str: The database URL constructed from PostgreSQL settings.
        """
        server = self.EVALUATOR_POSTGRES_SERVER or self.POSTGRES_SERVER
        port = self.EVALUATOR_POSTGRES_PORT or self.POSTGRES_PORT
        user = self.EVALUATOR_POSTGRES_USER or self.POSTGRES_USER
        password = self.EVALUATOR_POSTGRES_PASSWORD or self.POSTGRES_PASSWORD
        db = self.EVALUATOR_POSTGRES_DB or self.POSTGRES_DB
        return (
            f"postgresql+asyncpg://{user}:{password}"
            f"@{server}:{port}/{db}"
        )


settings = Settings()

