"""
API routes for associate-related operations in version 1.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.session import get_db
from app.v1.dependencies import check_permission
from app.v1.schemas.associate import (
    AssociateCreate,
    AssociateRead,
    AssociateUpdate,
)
from app.v1.schemas.response import PaginatedData
from app.v1.schemas.user import UserRead
from app.v1.services.admin.associate_service import associate_service

router = APIRouter()


@router.get("", response_model=PaginatedData[AssociateRead])
async def get_all_associates(
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("associates:access")),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: str | None = Query(None),
) -> Any:
    """Get all associates with pagination."""
    return await associate_service.get_all_associates(
        db=db, skip=skip, limit=limit, q=q
    )


@router.post(
    "", response_model=AssociateRead, status_code=status.HTTP_201_CREATED
)
async def create_associate(
    *,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("associates:manage")),
    associate_in: AssociateCreate,
) -> Any:
    """Create a new associate."""
    return await associate_service.create_associate(
        db=db, admin_user_id=user.id, associate_in=associate_in
    )


@router.get("/{associate_id}", response_model=AssociateRead)
async def get_associate(
    associate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("associates:access")),
) -> Any:
    """Get a specific associate by ID."""
    return await associate_service.get_associate_by_id(
        db=db, associate_id=associate_id
    )


@router.patch("/{associate_id}", response_model=AssociateRead)
async def update_associate(
    associate_id: uuid.UUID,
    *,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("associates:manage")),
    associate_update: AssociateUpdate,
) -> Any:
    """Update an associate."""
    return await associate_service.update_associate(
        db=db,
        admin_user_id=user.id,
        associate_id=associate_id,
        associate_update=associate_update,
    )


@router.delete("/{associate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_associate(
    associate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("associates:manage")),
) -> None:
    """Delete an associate."""
    await associate_service.delete_associate(
        db=db, admin_user_id=user.id, associate_id=associate_id
    )
