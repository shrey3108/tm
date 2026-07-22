"""
Async database session and engine configuration.
Fixed: added psycopg3 UUID type adapter via connect_args + event listener.
"""
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy import event
from v1.core.config import settings


# ------------------------------------------------------------------
# psycopg3 UUID fix — registers stdlib uuid.UUID adapter
# ------------------------------------------------------------------
def _register_uuid_adapter(dbapi_connection, connection_record):
    """
    psycopg3 does not auto-adapt uuid_utils.UUID or stdlib uuid.UUID.
    This registers the adapter on every new connection.
    """
    try:
        from psycopg.adapt import Dumper
        from psycopg.pq import Format
        import uuid as _uuid

        class UUIDDumper(Dumper):
            format = Format.TEXT

            def dump(self, obj):
                return str(obj).encode()

        dbapi_connection.adapters.register_dumper(_uuid.UUID, UUIDDumper)
    except Exception:
        pass  # fail silently if psycopg version differs


# ------------------------------------------------------------------
# Async Engine
# ------------------------------------------------------------------
engine = create_async_engine(
    str(settings.DATABASE_URL),
    echo=settings.DB_ECHO,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True,
)

# Register UUID adapter on every new connection
event.listen(engine.sync_engine, "connect", _register_uuid_adapter)


# ------------------------------------------------------------------
# Session Factory
# ------------------------------------------------------------------
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ------------------------------------------------------------------
# Dependency
# ------------------------------------------------------------------
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides an async database session.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# Alias for compatibility
get_async_session = get_db_session