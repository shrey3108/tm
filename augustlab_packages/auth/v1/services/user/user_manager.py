"""
User manager with business rules, registration logging, and session management.
Extends FastAPI-Users BaseUserManager with custom behavior.
"""
from fastapi_users import BaseUserManager, UUIDIDMixin
from fastapi import Request, Response, HTTPException, status
from uuid import UUID
from v1.core.config import settings
from v1.db.models.user import User
from v1.db.database import AsyncSessionLocal
from v1.repositories.auth_log import AuthLogRepository
from v1.repositories.session import SessionRepository
from v1.utils.request import get_client_ip
from v1.constants.enums.auth import AuthAction
from v1.constants.enums.oauth import OAuthProvider


class UserManager(UUIDIDMixin, BaseUserManager[User, UUID]):
    """
    Custom user manager with registration logging, session management,
    and proper error handling.
    """

    reset_password_token_secret = settings.SECRET_KEY
    verification_token_secret = settings.SECRET_KEY

    async def validate_password(
        self,
        password: str,
        user: User | None = None,
    ) -> None:
        """
        Called automatically during registration, password reset, password change.
        Skipped for OAuth users — they don't set a real password.
        """
        # ── Skip validation for OAuth users ──────────────────────────────────
        # OAuth users receive a random argon2/bcrypt hash as their password.
        # These hashes start with $ and are never user-supplied plaintext.
        if password.startswith("$argon2") or password.startswith("$2b"):
            return

        # ── Standard password rules for regular users ─────────────────────────
        if len(password) < 12:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 12 characters long",
            )

        if password.islower() or password.isupper():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must contain both upper and lower case letters",
            )

        if password.isalnum():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must contain at least one special character",
            )

    async def on_after_register(
        self,
        user: User,
        request: Request | None = None,
    ):
        print(f"✅ User {user.id} has registered.")

        if not request:
            return

        async with AsyncSessionLocal() as session:
            ip = get_client_ip(request)
            log_repo = AuthLogRepository(session)
            await log_repo.create(
                user_id=user.id,
                action=AuthAction.REGISTER,
                ip_address=ip,
                provider=OAuthProvider.EMAIL,
            )

    async def on_after_login(
        self,
        user: User,
        request: Request | None = None,
        response: Response | None = None,
    ):
        print(f"✅ User {user.id} has logged in.")

        if not request:
            return

        async with AsyncSessionLocal() as session:
            ip = get_client_ip(request)
            user_agent = request.headers.get("user-agent", "")[:255]

            log_repo = AuthLogRepository(session)
            await log_repo.create(
                user_id=user.id,
                action=AuthAction.LOGIN,
                ip_address=ip,
                provider=OAuthProvider.EMAIL,
            )

            session_repo = SessionRepository(session)
            await session_repo.create(
                user_id=user.id,
                ip_address=ip,
                user_agent=user_agent,
            )

    async def on_after_forgot_password(
        self,
        user: User,
        token: str,
        request: Request | None = None,
    ):
        print(f"User {user.id} has requested password reset.")
        print(f"Reset token: {token}")

    async def on_after_reset_password(
        self,
        user: User,
        request: Request | None = None,
    ):
        print(f"✅ User {user.id} has reset their password.")

        async with AsyncSessionLocal() as session:
            session_repo = SessionRepository(session)
            await session_repo.invalidate_user_sessions(user.id)