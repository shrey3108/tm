"""
User authentication routes.

This module provides endpoints for user registration, login, and retrieval.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.core import settings
from app.v1.core.logging import get_logger
from app.v1.db.session import get_db
from app.v1.dependencies.auth import get_current_user
from app.v1.schemas.user import (
    LoginResponse,
    RefreshTokenRequest,
    UserCreate,
    UserLogin,
    UserRead,
    UserRegister,
)
from app.v1.services.user_service import user_service
from app.v1.core.rate_limit import limiter

logger = get_logger(__name__)

router = APIRouter()


@router.post(
    "/register", response_model=UserRead, status_code=status.HTTP_201_CREATED
)
@limiter.exempt

async def register_user(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: UserRegister,
) -> Any:
    """
    Register a new user.

    Args:
        db: Async database session.
        user_in: User registration schema.

    Returns:
        The created user.
    """
    logger.info(
        f"Received request to register user with email: {user_in.email}"
    )
    return await user_service.register_user(db=db, user_in=user_in)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
@limiter.exempt

async def logout_user(
    *,
    db: AsyncSession = Depends(get_db),
    response: Response,
    current_user: UserRead = Depends(get_current_user),
) -> None:
    """
    Logout the current user.

    Args:
        db: Async database session.
        response: FastAPI response object.
        current_user: The currently authenticated user.
    """
    logger.info(f"Logout request for user: {current_user.email}")
    await user_service.logout_user(db=db, user_id=current_user.id)
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return None


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: UserCreate,
) -> Any:
    """
    Create a new user.

    Args:
        db: Async database session.
        user_in: User creation schema.

    Returns:
        The created user.
    """
    logger.info(f"Received request to create user with email: {user_in.email}")
    return await user_service.create_user(db=db, user_in=user_in)


@router.post("/login", response_model=LoginResponse)
@limiter.exempt

async def login_user(
    *,
    db: AsyncSession = Depends(get_db),
    response: Response,
    credentials: UserLogin,
) -> Any:
    """
    Login a user and return access/refresh tokens.

    Args:
        db: Async database session.
        response: FastAPI response object.
        credentials: User login credentials.

    Returns:
        Login response with tokens.
    """
    logger.info(f"Login attempt for email: {credentials.email}")
    login_response = await user_service.login_user(
        db=db, credentials=credentials
    )

    response.set_cookie(
        key="access_token",
        value=login_response.access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
    )
    response.set_cookie(
        key="refresh_token",
        value=login_response.refresh_token,
        httponly=True,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
    )

    return login_response


@router.post("/refresh", response_model=LoginResponse)
@limiter.exempt

async def refresh_token(
    *,
    db: AsyncSession = Depends(get_db),
    response: Response,
    request: RefreshTokenRequest,
) -> Any:
    """
    Refresh access token using a refresh token.

    Args:
        db: Async database session.
        response: FastAPI response object.
        request: Refresh token request schema.

    Returns:
        New login response with tokens.
    """
    logger.info("Token refresh attempt")
    login_response = await user_service.refresh_token(
        db=db, refresh_token=request.refresh_token
    )

    response.set_cookie(
        key="access_token",
        value=login_response.access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
    )
    response.set_cookie(
        key="refresh_token",
        value=login_response.refresh_token,
        httponly=True,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
    )

    return login_response


@router.post(
    "/login/swagger",
    response_model=LoginResponse,
    summary="Swagger login",
)
@limiter.exempt

async def swagger_login_user(
    *,
    db: AsyncSession = Depends(get_db),
    response: Response,
    credentials: OAuth2PasswordRequestForm = Depends(),
) -> Any:
    """
    Login a user using Swagger UI (OAuth2 Password flow).

    Args:
        db: Async database session.
        response: FastAPI response object.
        credentials: OAuth2 password request form.

    Returns:
        Login response with tokens.
    """
    logger.info(f"Swagger login attempt for email: {credentials.username}")
    login_response = await user_service.login_user(
        db=db,
        credentials=UserLogin(
            email=credentials.username,
            password=credentials.password,
        ),
    )

    response.set_cookie(
        key="access_token",
        value=login_response.access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
    )
    response.set_cookie(
        key="refresh_token",
        value=login_response.refresh_token,
        httponly=True,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
    )

    return login_response


@router.get("/me", response_model=UserRead)
async def read_user_me(
    current_user: UserRead = Depends(get_current_user),
) -> Any:
    """
    Get current user.
    """
    return current_user


@router.get("/{userid}", response_model=UserRead)
async def read_user(
    userid: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Retrieve a user by their ID.

    Args:
        userid: The UUID of the user.
        db: Async database session.

    Returns:
        The user information.
    """
    logger.debug(f"Fetching user with id={userid}")
    return await user_service.get_user_by_id(db=db, user_id=userid)
