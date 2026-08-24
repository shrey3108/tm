"""
Repository for session management.
"""
from datetime import datetime, timedelta, timezone
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from v1.db.models.session import Session
from v1.core.config import settings


class SessionRepository:
    """
    Session database operations.
    """
    
    def __init__(self, session: AsyncSession):
        """Initialize repository with DB session."""
        self.session = session
    
    async def create(
        self,
        user_id: UUID,
        access_token: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> Session:
        """Create a new session for a user."""
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
        
        session_record = Session(
            user_id=user_id,
            access_token=access_token,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent,
            is_active=True,
        )
        
        self.session.add(session_record)
        await self.session.commit()
        await self.session.refresh(session_record)
        
        return session_record
    
    async def get_by_user_id(self, user_id: UUID) -> list[Session]:
        """Get all active sessions for a user."""
        statement = select(Session).where(
            Session.user_id == user_id,
            Session.is_active == True,
            Session.expires_at > datetime.now(timezone.utc),
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())
    
    async def invalidate_user_sessions(self, user_id: UUID) -> None:
        """Invalidate all sessions for a user."""
        statement = (
            update(Session)
            .where(Session.user_id == user_id)
            .values(is_active=False)
        )
        await self.session.execute(statement)
        await self.session.commit()