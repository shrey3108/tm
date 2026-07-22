"""
FastAPI dependencies for authentication.
Provides user database and user manager instances for dependency injection.
"""
from typing import AsyncGenerator
from fastapi import Depends
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import AsyncSession
from v1.db.database import get_async_session
from v1.db.models.user import User
from v1.services.user.user_manager import UserManager

async def get_user_db(
    session: AsyncSession = Depends(get_async_session),
) -> AsyncGenerator[SQLAlchemyUserDatabase, None]:
    """
    FastAPI dependency to get user database instance.
    
    This is required by FastAPI-Users for user authentication.
    Must be a standalone function (not in class) because FastAPI-Users
    requires it to be a dependency that yields SQLAlchemyUserDatabase.
    
    Args:
        session: Injected database session
        
    Yields:
        SQLAlchemyUserDatabase: User database accessor
        
    Usage:
        user_db = Depends(get_user_db)
    """
    yield SQLAlchemyUserDatabase(session, User)


async def get_user_manager(
    user_db: SQLAlchemyUserDatabase = Depends(get_user_db),
) -> AsyncGenerator[UserManager, None]:
    """
    FastAPI dependency to get user manager instance.
    
    This is required by FastAPI-Users for handling user operations
    like registration, login, password reset, etc.
    
    Must be a standalone function (not in class) because FastAPI's
    dependency injection system requires it to be a callable that
    yields the manager instance.
    
    Args:
        user_db: Injected user database dependency
        
    Yields:
        UserManager: User manager with business rules
        
    Usage:
        user_manager = Depends(get_user_manager)
    """
    yield UserManager(user_db)