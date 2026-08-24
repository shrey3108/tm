"""
User repository module.

This module provides the data access layer for user operations
using FastCRUD and SQLAlchemy async sessions.
"""

from fastcrud import FastCRUD
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.v1.core.logging import get_logger
from app.v1.db.models.user import User
from app.v1.db.models.roles import Role
from app.v1.schemas.user import UserCreateInternal, UserModel, UserRead

logger = get_logger(__name__)


class UserRepository:
    """Repository for user database operations.

    Provides methods for CRUD operations on user data using FastCRUD.

    Attributes:
        crud: The FastCRUD instance configured for User model.
    """

    def __init__(self) -> None:
        """Initialize the user repository with a FastCRUD instance."""
        self.crud = FastCRUD(User)

    async def get_by_email(self, db: AsyncSession, email: str):
        """Get a user by email address.

        Args:
            db: The async database session.
            email: The email address to search for.

        Returns:
            The user object if found, None otherwise.
        """
        stmt = select(User).where(User.email == email).options(selectinload(User.role))
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        if user:
            user_data = UserModel.model_validate(user)
            if user.role:
                user_data.role_name = user.role.name
            return user_data
        return None

    async def get_by_auth_user_id(self, db: AsyncSession, auth_user_id):
        """Get a user by linked auth package user ID."""
        stmt = (
            select(User)
            .where(User.auth_user_id == auth_user_id)
            .options(selectinload(User.role))
        )
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        if user:
            user_data = UserModel.model_validate(user)
            if user.role:
                user_data.role_name = user.role.name
            return user_data
        return None

    async def get_by_id(self, db: AsyncSession, user_id):
        """Get a user by their unique ID.

        Args:
            db: The async database session.
            user_id: The UUID of the user to retrieve.

        Returns:
            The user object if found, None otherwise.
        """
        stmt = (
            select(User)
            .where(User.id == user_id)
            .options(selectinload(User.role).selectinload(Role.permissions))
        )
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        if user:
            # Manually populate role_name and permissions for UserRead
            user_read = UserRead.model_validate(user)
            if user.role:
                user_read.role_name = user.role.name
                user_read.permissions = [p.name for p in user.role.permissions]
            return user_read
        return None

    async def create(self, db: AsyncSession, user: UserCreateInternal):
        """Create a new user in the database.

        Args:
            db: The async database session.
            user: The internal user creation data with hashed password.

        Returns:
            The created user object.
        """
        created_user = await self.crud.create(
            db=db,
            object=user,
        )
        if created_user is None:
            db_user = await self.get_by_email(db=db, email=user.email)
            if db_user is None:
                raise ValueError("User was not created properly")
            user_id = db_user.id
        else:
            user_id = created_user["id"]
        # Fetch again with role info
        return await self.get_by_id(db=db, user_id=user_id)

    async def update_auth_user_link(
        self,
        db: AsyncSession,
        *,
        user_id,
        auth_user_id,
        full_name: str | None = None,
    ) -> None:
        """Link an application user to an auth package user ID."""
        values: dict[str, object] = {"auth_user_id": auth_user_id}
        if full_name:
            values["full_name"] = full_name

        await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(**values)
        )
        await db.commit()

    async def update_refresh_token(
        self,
        db: AsyncSession,
        *,
        user_id,
        refresh_token: str | None,
        refresh_token_expires_at,
    ) -> None:
        """Update a user's refresh token and its expiration.

        Args:
            db: The async database session.
            user_id: The ID of the user to update.
            refresh_token: The new refresh token string (can be None to clear).
            refresh_token_expires_at: The expiration datetime for the refresh token.
        """
        await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(
                refresh_token=refresh_token,
                refresh_token_expires_at=refresh_token_expires_at,
            )
        )
        await db.commit()

    async def clear_refresh_token(self, db: AsyncSession, user_id) -> None:
        """Clear a user's refresh token.

        Args:
            db: The async database session.
            user_id: The ID of the user to clear tokens for.
        """
        await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(
                refresh_token=None,
                refresh_token_expires_at=None,
            )
        )
        await db.commit()


user_repository = UserRepository()
