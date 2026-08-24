"""
Repository for authentication logs.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from v1.db.models.auth_log import AuthLog


class AuthLogRepository:
    """
    Auth log DB operations.
    """

    def __init__(self, session: AsyncSession):
        """
        Initialize repository with DB session.
        """
        self.session = session

    async def create(self, **data) -> None:
        """
        Create auth log entry.
        """
        log = AuthLog(**data)
        self.session.add(log)
        await self.session.commit()
