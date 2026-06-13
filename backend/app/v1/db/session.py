"""
Database session module.

This module provides the SQLAlchemy async engine, session maker,
and utility functions for database operations.
"""

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.v1.core.config import settings
from app.v1.core.logging import get_logger
from app.v1.db.base import Base  # noqa: F401

logger = get_logger(__name__)

engine = create_async_engine(
    settings.database_url,
    echo=True,
    poolclass=NullPool,
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db():
    """Dependency for getting async database sessions.

    Yields:
        AsyncSession: An async database session.
    """
    async with async_session_maker() as session:
        yield session


async def init_db():
    """Initialize the database by creating all tables.

    This function creates all tables defined by SQLAlchemy models
    that inherit from the Base class.
    """
    # Import all models here so SQLAlchemy metadata
    # is aware of all tables before create_all is called
    import app.v1.db  # noqa: F401
    import app.v1.db.base  # noqa: F401
    # import packages.auth.v1.models  # noqa: F401

    logger.info("Creating database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created successfully")
