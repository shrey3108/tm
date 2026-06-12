"""
User service module.

This module provides the business logic layer for user operations,
including user creation, retrieval, and listing.
"""

import uuid
import json

import jwt
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.core import settings
from app.v1.core.security import get_fernet_cipher
from app.v1.core.logging import get_logger
from app.v1.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.v1.db.models.roles import Role
from app.v1.repository.user_repository import user_repository
from app.v1.schemas.user import (
    LoginResponse,
    UserCreate,
    UserCreateInternal,
    UserLogin,
    UserRegister,
)

logger = get_logger(__name__)


class UserService:
    """Service for user business logic operations.

    Handles user-related operations including creation, retrieval,
    and listing with business rules and validation.
    """

    async def get_user_by_email(self, db: AsyncSession, email: str):
        """Get a user by email address.

        Args:
            db: The async database session.
            email: The email address to search for.

        Returns:
            The user object if found, None otherwise.
        """
        return await user_repository.get_by_email(db=db, email=email)

    async def get_user_by_id(self, db: AsyncSession, user_id: uuid.UUID):
        """Get a user by their unique ID.

        Args:
            db: The async database session.
            user_id: The UUID of the user to retrieve.

        Returns:
            The user object if found.

        Raises:
            HTTPException: If the user is not found (404).
        """
        user = await user_repository.get_by_id(db=db, user_id=user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )
        return user

    async def register_user(self, db: AsyncSession, user_in: UserRegister):
        """Register a new user with default 'Candidate' role.

        Args:
            db: The async database session.
            user_in: The user registration data.

        Returns:
            The newly created user object.

        Raises:
            HTTPException: If the email already exists (400).
        """
        user_exists = await self.get_user_by_email(db=db, email=user_in.email)
        if user_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The user with this email already exists in the system.",
            )

        # Get or create candidate role
        stmt = select(Role).where(Role.name == "Candidate")
        result = await db.execute(stmt)
        role = result.scalar_one_or_none()

        if not role:
            role = Role(name="Candidate")
            db.add(role)
            await db.flush()

        db_obj = UserCreateInternal(
            email=user_in.email,
            password_hash=hash_password(user_in.password),
            full_name=user_in.full_name,
            is_active=True,
            role_id=role.id,
        )
        created_user = await user_repository.create(db=db, user=db_obj)
        logger.info(f"Registered new user with email: {user_in.email}")
        return created_user

    async def create_user(self, db: AsyncSession, user_in: UserCreate):
        """Create a new user in the system.

        Validates that the email is unique and the role exists before creation.
        Hashes the user password before storing.

        Args:
            db: The async database session.
            user_in: The user creation data.

        Returns:
            The newly created user object.

        Raises:
            HTTPException: If the email already exists (400) or role is invalid (400).
        """
        user_exists = await self.get_user_by_email(db=db, email=user_in.email)
        if user_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The user with this email already exists in the system.",
            )

        role = await db.get(Role, user_in.role_id)
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The specified role does not exist.",
            )

        db_obj = UserCreateInternal(
            email=user_in.email,
            password_hash=hash_password(user_in.password),
            full_name=user_in.full_name,
            is_active=user_in.is_active,
            role_id=user_in.role_id,
        )
        created_user = await user_repository.create(db=db, user=db_obj)
        logger.info(f"Created new user with email: {user_in.email}")
        return created_user

    async def login_user(
        self, db: AsyncSession, credentials: UserLogin
    ) -> LoginResponse:
        """Authenticate a user and return access/refresh tokens.

        Args:
            db: The async database session.
            credentials: User login credentials (email and password).

        Returns:
            A LoginResponse containing tokens and user information.

        Raises:
            HTTPException: If authentication fails (401) or user is inactive (403).
        """
        user = await self.get_user_by_email(db=db, email=credentials.email)
        if not user or not verify_password(
            credentials.password, user.password_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Inactive user.",
            )

        access_token, expires_at = create_access_token(
            subject=str(user.id),
            email=user.email,
        )
        refresh_token, refresh_token_expires_at = create_refresh_token(
            subject=str(user.id),
            email=user.email,
        )
        await user_repository.update_refresh_token(
            db=db,
            user_id=user.id,
            refresh_token=refresh_token,
            refresh_token_expires_at=refresh_token_expires_at,
        )
        user_read = await self.get_user_by_id(db=db, user_id=user.id)
        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at,
            refresh_token_expires_at=refresh_token_expires_at,
            user=user_read,
        )

    async def logout_user(self, db: AsyncSession, user_id: uuid.UUID) -> None:
        """Logout a user by clearing their refresh token.

        Args:
            db: The async database session.
            user_id: The UUID of the user to logout.
        """
        await user_repository.clear_refresh_token(db=db, user_id=user_id)
        logger.info(f"User logged out: {user_id}")

    async def refresh_token(
        self, db: AsyncSession, refresh_token: str
    ) -> LoginResponse:
        """Refresh a user's access token using a valid refresh token.

        Args:
            db: The async database session.
            refresh_token: The user's refresh token.

        Returns:
            A LoginResponse containing new tokens and user information.

        Raises:
            HTTPException: If token is invalid, expired, or doesn't match the user.
        """
        try:
            payload = jwt.decode(
                refresh_token,
                settings.SECRET_KEY,
                algorithms=["HS256"],
            )
        except jwt.ExpiredSignatureError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has expired.",
            ) from exc
        except jwt.PyJWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token.",
            ) from exc

        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type.",
            )

        enc_data = payload.get("enc_data")
        if enc_data:
            try:
                cipher = get_fernet_cipher()
                inner_payload = json.loads(cipher.decrypt(enc_data.encode()).decode("utf-8"))
                subject = inner_payload.get("sub")
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid encrypted token.",
                ) from exc
        else:
            # Fallback for old tokens
            subject = payload.get("sub")

        if not subject:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload.",
            )

        try:
            user_id = uuid.UUID(subject)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token subject.",
            ) from exc

        user = await self.get_user_by_id(db=db, user_id=user_id)
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Inactive user.",
            )

        if user.refresh_token != refresh_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or revoked refresh token.",
            )

        access_token, expires_at = create_access_token(
            subject=str(user.id),
            email=user.email,
        )
        new_refresh_token, refresh_token_expires_at = create_refresh_token(
            subject=str(user.id),
            email=user.email,
        )

        await user_repository.update_refresh_token(
            db=db,
            user_id=user.id,
            refresh_token=new_refresh_token,
            refresh_token_expires_at=refresh_token_expires_at,
        )

        user_read = await self.get_user_by_id(db=db, user_id=user.id)
        return LoginResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            expires_at=expires_at,
            refresh_token_expires_at=refresh_token_expires_at,
            user=user_read,
        )


user_service = UserService()
