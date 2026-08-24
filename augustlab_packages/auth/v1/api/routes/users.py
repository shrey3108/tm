"""
User management endpoints.
"""
from fastapi import APIRouter
from v1.core.auth import fastapi_users
from v1.schemas.user import CustomUserRead, CustomUserUpdate

router = APIRouter()

# User management routes (me, user by id, etc.)
router.include_router(
    fastapi_users.get_users_router(CustomUserRead, CustomUserUpdate),
    tags=["users"],
)