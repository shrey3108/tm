"""
API routes for guideline-related operations in version 1.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.session import get_db
from app.v1.dependencies import check_permission
from app.v1.schemas.guideline import (
    GuidelineCreate,
    GuidelineRead,
    GuidelineUpdate,
)
from app.v1.schemas.response import PaginatedData
from app.v1.schemas.user import UserRead
from app.v1.services.admin.guideline_service import guideline_service

router = APIRouter()


@router.get("", response_model=PaginatedData[GuidelineRead])
async def get_all_guidelines(
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:access")),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: str | None = Query(None),
) -> Any:
    """Get all guidelines with pagination."""
    return await guideline_service.get_all_guidelines(
        db=db, skip=skip, limit=limit, q=q
    )


@router.post(
    "", response_model=GuidelineRead, status_code=status.HTTP_201_CREATED
)
async def create_guideline(
    *,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:manage")),
    guideline_in: GuidelineCreate,
) -> Any:
    """Create a new guideline template."""
    return await guideline_service.create_guideline(
        db=db, admin_user_id=user.id, guideline_in=guideline_in
    )


@router.get("/{guideline_id}", response_model=GuidelineRead)
async def get_guideline(
    guideline_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:access")),
) -> Any:
    """Get a specific guideline template by ID."""
    return await guideline_service.get_guideline_by_id(
        db=db, guideline_id=guideline_id
    )


@router.patch("/{guideline_id}", response_model=GuidelineRead)
async def update_guideline(
    guideline_id: uuid.UUID,
    *,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:manage")),
    guideline_update: GuidelineUpdate,
) -> Any:
    """Update a guideline template."""
    return await guideline_service.update_guideline(
        db=db,
        admin_user_id=user.id,
        guideline_id=guideline_id,
        guideline_update=guideline_update,
    )


@router.delete("/{guideline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_guideline(
    guideline_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:manage")),
) -> None:
    """Delete a guideline template."""
    await guideline_service.delete_guideline(
        db=db, admin_user_id=user.id, guideline_id=guideline_id
    )
