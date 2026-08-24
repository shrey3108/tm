"""
Database configuration and session management.
Single source of truth for all database operations.
"""
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
    AsyncEngine,
)
from sqlalchemy.orm import declarative_base
from v1.core.config import settings


# ============================================================================
# Database Engine
# ============================================================================

def get_engine() -> AsyncEngine:
    """
    Create and configure async database engine.
    
    Returns:
        Configured AsyncEngine instance
    """
    return create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DB_ECHO,
        pool_pre_ping=True,  # Verify connections before use
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_recycle=3600,  # Recycle connections after 1 hour
    )


# Create engine instance
engine = get_engine()


# ============================================================================
# Session Factory
# ============================================================================

def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """
    Create async session factory.
    
    Returns:
        Configured async session maker
    """
    return async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,  # Don't expire objects after commit
        autocommit=False,
        autoflush=False,
    )


# Create session factory instance
AsyncSessionLocal = get_session_factory()


# ============================================================================
# Base Model
# ============================================================================

Base = declarative_base()


# ============================================================================
# Dependency Injection
# ============================================================================

async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency to get async database session.
    
    Provides automatic session lifecycle management:
    - Creates session
    - Yields session for use
    - Ensures proper cleanup and closure
    
    Usage:
        @router.get("/users")
        async def get_users(session: AsyncSession = Depends(get_async_session)):
            # Use session here
            ...
    
    Yields:
        AsyncSession: Database session
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ============================================================================
# Database Initialization
# ============================================================================

async def create_db_and_tables() -> None:
    """
    Create all database tables.
    
    Should be called during application startup:
        @app.on_event("startup")
        async def startup():
            await create_db_and_tables()
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_db_and_tables() -> None:
    """
    Drop all database tables.
    
    ⚠️ WARNING: This will delete all data!
    Only use in development/testing.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def close_db_connection() -> None:
    """
    Close database engine and all connections.
    
    Should be called during application shutdown:
        @app.on_event("shutdown")
        async def shutdown():
            await close_db_connection()
    """
    await engine.dispose()


# ============================================================================
# Testing Utilities
# ============================================================================

async def get_test_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Get database session for testing.
    
    Creates isolated session with automatic rollback.
    
    Usage in tests:
        @pytest.fixture
        async def session():
            async for session in get_test_session():
                yield session
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.rollback()
            await session.close()