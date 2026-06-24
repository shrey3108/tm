"""
Admin System routes module.

Provides administrative endpoints for system-wide operations like cache management.
"""

from typing import Any
from fastapi import APIRouter, Depends, Query
from app.v1.dependencies import check_permission
from app.v1.schemas.response import Response
from app.v1.schemas.user import UserRead
from app.v1.services.admin_service import admin_service

router = APIRouter()

@router.get(
    "/cache",
    response_model=Response[dict],
    summary="Inspect System Cache",
    tags=["admin"]
)
async def inspect_system_cache(
    pattern: str | None = Query(None, description="Optional key pattern to list (e.g. 'jobs', 'analytics')"),
    admin: UserRead = Depends(check_permission("system:manage")),
) -> Any:
    """
    List active cache keys.
    Requires 'system:manage' permission.
    """
    info = await admin_service.get_cache_info(pattern=pattern)
    return Response[dict](data=info, message="Cache information retrieved")

@router.delete(
    "/cache",
    response_model=Response[bool],
    summary="Clear System Cache",
    tags=["admin"]
)
async def clear_system_cache(
    pattern: list[str] | None = Query(None, description="Optional key patterns to clear (e.g. ['jobs', 'analytics'])"),
    admin: UserRead = Depends(check_permission("system:manage")),
) -> Any:
    """
    Clear the system cache (Redis).
    - If **pattern** is provided, only matching keys are deleted.
    - If no pattern is provided, all application-related keys are cleared.
    """
    success = await admin_service.clear_cache(pattern=pattern)
    if success:
        return Response[bool](data=True, message="Cache cleared successfully")
    return Response[bool](success=False, data=False, message="Failed to clear cache")
