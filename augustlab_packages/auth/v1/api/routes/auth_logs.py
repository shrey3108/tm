"""
Authentication log endpoints.
"""
from fastapi import APIRouter, Depends
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from v1.core.auth import current_active_user
from v1.schemas.auth_log import AuthLogRead
from v1.db.models.user import User
from v1.db.session import get_db_session
from v1.repositories.auth_log import AuthLogRepository

router = APIRouter(
    tags=["Auth Logs"],
)


@router.get("/", response_model=List[AuthLogRead])
async def list_auth_logs(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_db_session),
):
    """
    List authentication logs for the current user.
    """
    repo = AuthLogRepository(session)
    # TODO: Implement a real query for logs by user_id
    # logs = await repo.list_by_user(user.id)
    return []