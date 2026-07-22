"""
Repository for user database operations.
Handles all direct user-related database queries.
"""
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from v1.db.models.user import User


class UserRepository:
    """
    User database operations.
    Pure data access layer - no business logic.
    """
    
    def __init__(self, session: AsyncSession):
        """
        Initialize repository with database session.
        
        Args:
            session: SQLAlchemy async session
        """
        self.session = session
    
    async def get_by_id(self, user_id: UUID) -> Optional[User]:
        """
        Get user by UUID.
        
        Args:
            user_id: User UUID
            
        Returns:
            User object or None if not found
        """
        statement = select(User).where(User.id == user_id)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()
    
    async def get_by_email(self, email: str) -> Optional[User]:
        """
        Get user by email address.
        
        Args:
            email: User email
            
        Returns:
            User object or None if not found
        """
        statement = select(User).where(User.email == email)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()
    
    async def exists_by_id(self, user_id: UUID) -> bool:
        """
        Check if user exists by UUID.
        
        Args:
            user_id: User UUID
            
        Returns:
            True if user exists, False otherwise
        """
        user = await self.get_by_id(user_id)
        return user is not None
    
    async def exists_by_email(self, email: str) -> bool:
        """
        Check if user exists by email.
        
        Args:
            email: User email
            
        Returns:
            True if user exists, False otherwise
        """
        user = await self.get_by_email(email)
        return user is not None
    
    async def create(self, **user_data) -> User:
        """
        Create a new user.
        
        Args:
            **user_data: User fields
            
        Returns:
            Created user object
        """
        user = User(**user_data)
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user
    
    async def update(self, user_id: UUID, **update_data) -> Optional[User]:
        """
        Update user fields.
        
        Args:
            user_id: User UUID
            **update_data: Fields to update
            
        Returns:
            Updated user or None if not found
        """
        user = await self.get_by_id(user_id)
        if not user:
            return None
        
        for key, value in update_data.items():
            setattr(user, key, value)
        
        await self.session.commit()
        await self.session.refresh(user)
        return user