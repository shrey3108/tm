"""
Configuration module.

This module defines the application settings using Pydantic BaseSettings.
Settings are loaded from environment variables and .env files.
"""

from pathlib import Path

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.v1.core.logging import get_logger

logger = get_logger(__name__)


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    Attributes:
        PROJECT_NAME: The name of the project.
        ENVIRONMENT: The deployment environment.
        DEBUG: Whether debug mode is enabled.
        SECRET_KEY: Secret key for JWT signing.
        ACCESS_TOKEN_EXPIRE_MINUTES: Expiration time for access tokens in minutes.
        REFRESH_TOKEN_EXPIRE_DAYS: Expiration time for refresh tokens in days.
        POSTGRES_SERVER: PostgreSQL server hostname.
        POSTGRES_PORT: PostgreSQL server port.
        POSTGRES_USER: PostgreSQL username.
        POSTGRES_PASSWORD: PostgreSQL password.
        POSTGRES_DB: PostgreSQL database name.
        SQLALCHEMY_DATABASE_URI: Optional explicit database URI override.
        BACKEND_CORS_ORIGINS: List of allowed CORS origins.
        OLLAMA_URL: URL for the Ollama service.
        OLLAMA_MODEL: Name of the Ollama model to use.
        OLLAMA_API_KEY: API key for Ollama Cloud (if applicable).
        EMBEDDING_MODEL_NAME: Name of the sentence-transformers model to use for embeddings.
        EMBEDDING_VECTOR_DIM: Dimension of the embedding vectors.
        EMBEDDING_TRUNCATE_DIM: Dimension to truncate embeddings to.
        EMBEDDING_USE_INSTRUCTIONS: Whether to use instructions for generating embeddings.
        LANGEXTRACT_RETRY_ATTEMPTS: Number of retry attempts for extraction.
        LANGEXTRACT_RETRY_DELAY: Delay between retry attempts in seconds.
        RESUME_MAX_SIZE_MB: Maximum allowed size for resume uploads in MB.
        RESUME_UPLOAD_DIR: Directory where uploaded resumes are stored.
        ALLOWED_RESUME_EXTENSIONS: List of allowed file extensions for resumes.
        RESUME_PROCESSING_MAX_WORKERS: Maximum number of parallel workers for resume processing.
        ADMIN_ROLE_NAME: Role name for the admin user.
        ADMIN_EMAIL: Email address for the default admin user.
        ADMIN_PASSWORD: Password for the default admin user.
        ADMIN_FULL_NAME: Full name for the default admin user.
        REDIS_URL: URL for the Redis cache service.
        CACHE_TTL_SECONDS: Time-to-live for cached items in seconds.
    """

    # Resolve .env relative to this file: backend/app/v1/core/config.py → root/.env
    _env_file: Path = Path(__file__).resolve().parents[4] / ".env"

    model_config = SettingsConfigDict(
        env_file=str(_env_file),
        env_ignore_empty=True,
        extra="ignore",
    )

    PROJECT_NAME: str = Field(
        default="Hiring Platform", description="The name of the project"
    )
    ENVIRONMENT: str = Field(
        default="development",
        description="The deployment environment (e.g., development, staging, production)",
    )
    DEBUG: bool = Field(
        default=False, description="Whether debug mode is enabled"
    )
    SECRET_KEY: str = Field(
        default="",
        description="Secret key for JWT signing. Generate using 'openssl rand -hex 32'",
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=60, description="Expiration time for access tokens in minutes"
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(
        default=7, description="Expiration time for refresh tokens in days"
    )

    # Postgres
    POSTGRES_SERVER: str = Field(
        default="localhost", description="PostgreSQL server hostname"
    )
    POSTGRES_PORT: int = Field(
        default=5432, description="PostgreSQL server port"
    )
    POSTGRES_USER: str = Field(
        default="postgres", description="PostgreSQL username"
    )
    POSTGRES_PASSWORD: str = Field(
        default="postgres", description="PostgreSQL password"
    )
    POSTGRES_DB: str = Field(
        default="app", description="PostgreSQL database name"
    )

    # Optional explicit override
    SQLALCHEMY_DATABASE_URI: str | None = Field(
        default=None, description="Optional explicit database URI override"
    )

    @computed_field
    @property
    def database_url(self) -> str:
        """Generate the database URL for SQLAlchemy.

        Returns:
            str: The database URL, either from explicit override or constructed
                 from individual PostgreSQL settings.
        """
        if self.SQLALCHEMY_DATABASE_URI:
            logger.info("Using explicit SQLALCHEMY_DATABASE_URI")
            return self.SQLALCHEMY_DATABASE_URI
        logger.info(
            f"Connecting to database: {self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = Field(
        default=[
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:8000",
        ],
        description="List of allowed CORS origins",
    )

    # Ollama
    OLLAMA_URL: str = Field(
        default="https://ollama.com/v1",
        description="URL for the Ollama service",
    )
    OLLAMA_MODEL: str = Field(
        default="glm_5:cloud", description="Name of the Ollama model to use"
    )
    OLLAMA_API_KEY: str = Field(
        default="d35ce7accc034bbc86f51347ae810ea6.mc4X9BO4XwHPR23bcHFtHWLV",
        description="API key for Ollama Cloud (if applicable)",
    )
    OLLAMA_TIMEOUT: int = Field(
        default=120, description="Timeout for Ollama API calls in seconds"
    )

    # Embeddings
    EMBEDDING_MODEL_NAME: str = Field(
        default="sentence-transformers/all-MiniLM-L6-v2",
        description="Name of the sentence-transformers model to use for embeddings",
    )
    EMBEDDING_VECTOR_DIM: int = Field(
        default=384, description="Dimension of the embedding vectors"
    )
    EMBEDDING_TRUNCATE_DIM: int = Field(
        default=384, description="Dimension to truncate embeddings to"
    )
    EMBEDDING_USE_INSTRUCTIONS: bool = Field(
        default=False,
        description="Whether to use instructions for generating embeddings",
    )

    # LangExtract Retry
    LANGEXTRACT_RETRY_ATTEMPTS: int = Field(
        default=3, description="Number of retry attempts for extraction"
    )
    LANGEXTRACT_RETRY_DELAY: int = Field(
        default=5, description="Delay between retry attempts in seconds"
    )

    # Resume uploads
    RESUME_MAX_SIZE_MB: int = Field(
        default=5, description="Maximum allowed size for resume uploads in MB"
    )
    RESUME_UPLOAD_DIR: str = Field(
        default="uploads/resumes",
        description="Directory where uploaded resumes are stored",
    )
    TRANSCRIPT_UPLOAD_DIR: str = Field(
        default="uploads/transcripts",
        description="Directory where uploaded interview transcripts are stored",
    )
    ALLOWED_RESUME_EXTENSIONS: list[str] = Field(
        default=["pdf", "docx"],
        description="List of allowed file extensions for resumes",
    )
    RESUME_PROCESSING_MAX_WORKERS: int = Field(
        default=4,
        description="Maximum number of parallel workers for resume processing",
    )

    # admin user
    ADMIN_ROLE_NAME: str = Field(
        default="admin", description="Role name for the admin user"
    )
    ADMIN_EMAIL: str = Field(
        default="admin@example.com",
        description="Email address for the default admin user",
    )
    ADMIN_PASSWORD: str = Field(
        default="admin123", description="Password for the default admin user"
    )
    ADMIN_FULL_NAME: str = Field(
        default="admin", description="Full name for the default admin user"
    )

    # Redis cache
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="URL for the Redis cache service",
    )
    CACHE_TTL_SECONDS: int = Field(
        default=300, description="Time-to-live for cached items in seconds"
    )

    ENABLE_OBSERVABILITY: bool = Field(
        default=True,
        description="Whether to enable OpenTelemetry tracing",
    )
    PHOENIX_PROJECT_NAME: str = Field(
        default="hiring-platform", description="Project name for Arize Phoenix"
    )
    PHOENIX_COLLECTOR_ENDPOINT: str = Field(
        default="http://localhost:4317",
        description="OTLP collector endpoint for Phoenix",
    )
    PHOENIX_SERVICE_NAME: str = Field(
        default="hiring-platform-backend", description="Service name for tracing"
    )

    SKIP_RESUME_CONTEXT: bool = Field(
        default=False, 
        description="Whether to skip sending resume context to LLM during evaluation"
    )

    USE_CROSS_ENCODER: bool = Field(
        default=False,
        description="Whether to use a cross-encoder for re-ranking",
    )

    @computed_field
    @property
    def CELERY_BROKER_URL(self) -> str:
        """The broker URL for Celery, defaulting to REDIS_URL."""
        return self.REDIS_URL


settings = Settings()
