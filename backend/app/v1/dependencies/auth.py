"""
Authentication dependencies.

This module provides Fastapi dependencies for authentication,
specifically for retrieving the current authenticated user.
"""

import jwt
import json
from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.core.config import settings
from app.v1.core.security import get_fernet_cipher
from app.v1.db.session import get_db
from app.v1.schemas.user import UserRead
from app.v1.services.user_service import user_service

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/users/login/swagger",
    auto_error=False,
    description="Use your email in the username field and your account password.",
)


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> UserRead:
    """
    Get the currently authenticated user from the access token.

    Args:
        token: The OAuth2 access token.
        db: Async database session.

    Returns:
        The current authenticated user.

    Raises:
        HTTPException: If authentication fails, token is invalid, or user is inactive.
    """
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
        )

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=["HS256"],
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token has expired.",
        ) from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token.",
        ) from exc

    if payload.get("type") == "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh tokens cannot be used for this endpoint.",
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
            detail="Invalid access token payload.",
        )

    try:
        user_id = UUID(subject)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token subject.",
        ) from exc

    user = await user_service.get_user_by_id(db=db, user_id=user_id)
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user.",
        )
    return user
