"""
Service for user-related business operations.
Contains user validation, retrieval, and business logic.
"""
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from v1.db.models.user import User
from v1.repositories.user import UserRepository


class UserService:
    """
    User business logic service.
    Orchestrates user operations and enforces business rules.
    """
    
    def __init__(self, session: AsyncSession):
        """
        Initialize service with database session.
        
        Args:
            session: SQLAlchemy async session
        """
        self.session = session
        self.user_repo = UserRepository(session)
    
    async def validate_user_exists(self, user_id: str) -> User:
        """
        Validate that a user exists and return the user object.
        
        This method:
        1. Validates UUID format
        2. Checks user exists in database
        3. Raises appropriate HTTP exceptions for errors
        
        Args:
            user_id: User ID as string
            
        Returns:
            User object if found
            
        Raises:
            HTTPException: 400 if invalid UUID format
            HTTPException: 404 if user not found
            
        Usage:
            # In route handlers
            user = await UserService(session).validate_user_exists(user_id)
        """
        # Validate UUID format
        try:
            user_uuid = UUID(user_id)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid user ID format"
            )
        
        # Get user from database
        user = await self.user_repo.get_by_id(user_uuid)
        
        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
        
        return user
    
    async def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        """
        Get user by ID without validation (returns None if not found).
        
        Args:
            user_id: User UUID
            
        Returns:
            User object or None
        """
        return await self.user_repo.get_by_id(user_id)
    
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """
        Get user by email address.
        
        Args:
            email: User email
            
        Returns:
            User object or None
        """
        return await self.user_repo.get_by_email(email)
    
    async def ensure_user_active(self, user: User) -> User:
        """
        Verify user account is active.
        
        Args:
            user: User object
            
        Returns:
            User if active
            
        Raises:
            HTTPException: 403 if user is inactive
        """
        if not user.is_active:
            raise HTTPException(
                status_code=403,
                detail="User account is inactive"
            )
        return user
    
    async def ensure_user_verified(self, user: User) -> User:
        """
        Verify user email is verified.
        
        Args:
            user: User object
            
        Returns:
            User if verified
            
        Raises:
            HTTPException: 403 if user is not verified
        """
        if not user.is_verified:
            raise HTTPException(
                status_code=403,
                detail="Email verification required"
            )
        return user