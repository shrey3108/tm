"""
Auth session service.
Handles auth logging and session lifecycle.
"""
from uuid import UUID
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from v1.db.models.user import User
from v1.repositories.auth_log import AuthLogRepository
from v1.repositories.session import SessionRepository
from v1.utils.request import get_client_ip
from v1.constants.enums.auth import AuthAction
from v1.db.models.session import Session
from v1.db.models.user import User

class AuthSessionService:
    """
    Manages authentication side effects:
    - auth logs
    - session records
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.auth_log_repo = AuthLogRepository(session)
        self.session_repo = SessionRepository(session)

    async def is_session_valid(self, user: User) -> bool:
        now = datetime.now(timezone.utc)

        result = await self.session.execute(
            select(Session)
            .where(Session.user_id == user.id)
            .where(Session.is_active == True)
            .where(Session.expires_at > now)
            .limit(1)   
        )

        active_session = result.scalars().first()  # ✅ SAFE
        return active_session is not None

    async def create_login_session(
        self,
        request: Request,
        user: User,
        provider: str,
        action: AuthAction = AuthAction.LOGIN,
    ) -> None:
        ip = get_client_ip(request)

        await self.auth_log_repo.create(
            user_id=user.id,
            action=action,
            ip_address=ip,
            provider=provider,
        )

        await self.session_repo.create(
            user_id=user.id,
            ip_address=ip,
            user_agent=request.headers.get("user-agent"),
        )

    async def log_auth_event(
        self,
        user_id: UUID,
        action: AuthAction,
        request: Request,
        provider: str = "email",
    ) -> None:
        ip = get_client_ip(request)

        await self.auth_log_repo.create(
            user_id=user_id,
            action=action,
            ip_address=ip,
            provider=provider,
        )

    async def invalidate_all_user_sessions(self, user_id: UUID) -> None:
        await self.session_repo.invalidate_user_sessions(user_id)
