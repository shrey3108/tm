import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.session import get_db
from app.v1.db.models.designations import Designation
from app.v1.dependencies import check_permission
from app.v1.schemas.designation import DesignationCreate, DesignationRead, DesignationUpdate
from app.v1.schemas.user import UserRead

router = APIRouter()

@router.get("", response_model=list[DesignationRead])
async def get_designations(
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("associates:access")),
) -> Any:
    """Retrieve all designations."""
    stmt = select(Designation).order_by(Designation.name)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("", response_model=DesignationRead, status_code=status.HTTP_201_CREATED)
async def create_designation(
    *,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("associates:manage")),
    designation_in: DesignationCreate,
) -> Any:
    """Create a new designation."""
    # Check if designation already exists
    stmt = select(Designation).where(Designation.name.ilike(designation_in.name))
    result = await db.execute(stmt)
    if result.scalars().first():
        raise HTTPException(
            status_code=400,
            detail="The designation with this name already exists in the system.",
        )

    designation = Designation(name=designation_in.name)
    db.add(designation)
    await db.commit()
    await db.refresh(designation)
    return designation

@router.delete("/{designation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_designation(
    *,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("associates:manage")),
    designation_id: uuid.UUID,
) -> None:
    """Delete a designation."""
    designation = await db.get(Designation, designation_id)
    if not designation:
        raise HTTPException(status_code=404, detail="Designation not found")
        
    await db.delete(designation)
    await db.commit()

@router.put("/{designation_id}", response_model=DesignationRead)
async def update_designation(
    *,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("associates:manage")),
    designation_id: uuid.UUID,
    designation_in: DesignationUpdate,
) -> Any:
    """Update a designation."""
    designation = await db.get(Designation, designation_id)
    if not designation:
        raise HTTPException(status_code=404, detail="Designation not found")
        
    # Check if designation already exists
    if designation_in.name != designation.name:
        stmt = select(Designation).where(Designation.name.ilike(designation_in.name))
        result = await db.execute(stmt)
        if result.scalars().first():
            raise HTTPException(
                status_code=400,
                detail="The designation with this name already exists in the system.",
            )
            
    designation.name = designation_in.name
    await db.commit()
    await db.refresh(designation)
    return designation
