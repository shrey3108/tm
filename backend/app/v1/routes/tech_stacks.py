import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.session import get_db
from app.v1.dependencies import check_permission
from app.v1.schemas.tech_stack import TechStackCreate, TechStackRead, TechStackUpdate
from app.v1.services.admin.tech_stack_service import tech_stack_service
from app.v1.schemas.user import UserRead
from app.v1.schemas.response import PaginatedData

router = APIRouter()

@router.get("", response_model=PaginatedData[TechStackRead])
async def get_tech_stacks(
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("tech_stacks:access")),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: str | None = Query(None),
):
    """Get all tech stacks with pagination and search."""
    return await tech_stack_service.get_all_tech_stacks(db, skip=skip, limit=limit, search=q)


@router.get("/{tech_stack_id}", response_model=TechStackRead)
async def get_tech_stack(
    tech_stack_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("tech_stacks:access")),
):
    """Get a tech stack by ID."""
    tech_stack = await tech_stack_service.get_tech_stack_by_id(db, tech_stack_id)
    if not tech_stack:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="TechStack not found",
        )
    return tech_stack


@router.post("", response_model=TechStackRead, status_code=status.HTTP_201_CREATED)
async def create_tech_stack(
    tech_stack_in: TechStackCreate,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("tech_stacks:manage")),
):
    """Create a new tech stack (Super Admin/HR Admin only)."""
    try:
        return await tech_stack_service.create_tech_stack(db, user.id, tech_stack_in)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{tech_stack_id}", response_model=TechStackRead)
async def update_tech_stack(
    tech_stack_id: uuid.UUID,
    tech_stack_in: TechStackUpdate,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("tech_stacks:manage")),
):
    """Update a tech stack (Super Admin/HR Admin only)."""
    try:
        tech_stack = await tech_stack_service.update_tech_stack(db, user.id, tech_stack_id, tech_stack_in)
        if not tech_stack:
            raise HTTPException(status_code=404, detail="TechStack not found")
        return tech_stack
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{tech_stack_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tech_stack(
    tech_stack_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("tech_stacks:manage")),
):
    """Delete a tech stack (Super Admin/HR Admin only)."""
    try:
        success = await tech_stack_service.delete_tech_stack(db, user.id, tech_stack_id)
        if not success:
            raise HTTPException(status_code=404, detail="TechStack not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
