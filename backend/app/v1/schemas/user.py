"""
User schema module.

This module defines Pydantic models for user data validation
and serialization in the API.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class UserModel(BaseModel):
    """Full database model representation of a user.

    Includes sensitive information like password hashes and internal fields.
    """

    id: uuid.UUID
    full_name: str | None = None
    email: EmailStr
    password_hash: str
    refresh_token: str | None = None
    refresh_token_expires_at: datetime | None = None
    is_active: bool = True
    role_id: uuid.UUID | None = None
    role_name: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class UserRegister(BaseModel):
    """Schema for initial user registration.

    Used when a user signs up on the platform.
    """

    email: EmailStr
    password: str
    full_name: str


class UserCreate(BaseModel):
    """Schema for creating a user (internal/admin use).

    Includes role assignment and status.
    """

    email: EmailStr
    password: str
    full_name: str | None = None
    is_active: bool = True
    role_id: uuid.UUID


class UserLogin(BaseModel):
    """Schema for user login credentials."""

    email: EmailStr
    password: str


class UserCreateInternal(BaseModel):
    """Internal schema for creating a user in the database.

    Includes the password hash instead of plain text password.
    """

    email: EmailStr
    password_hash: str
    full_name: str | None = None
    is_active: bool = True
    role_id: uuid.UUID


class UserRead(BaseModel):
    """Schema for reading user information.

    Matches the user data returned in API responses, excluding sensitive fields.
    """

    id: uuid.UUID
    full_name: str | None = None
    email: EmailStr
    is_active: bool = True
    role_id: uuid.UUID | None = None
    role_name: str | None = None
    permissions: list[str] = []
    created_at: datetime | None = None
    updated_at: datetime | None = None
    refresh_token:str|None = None

    model_config = ConfigDict(from_attributes=True)


class LoginResponse(BaseModel):
    """Schema for the login response.

    Contains authentication tokens and the authenticated user's details.
    """

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_at: datetime
    refresh_token_expires_at: datetime
    user: UserRead


class RefreshTokenRequest(BaseModel):
    """Schema for refreshing an access token."""

    refresh_token: str
