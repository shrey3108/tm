"""
Associate service for admin-level associate management.
"""

import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.models.associates import Associate
from app.v1.repository.associate_repository import associate_repository
from app.v1.schemas.associate import AssociateCreate, AssociateRead, AssociateUpdate
from app.v1.schemas.response import PaginatedData
from app.v1.services.admin.audit_service import audit_service
from app.v1.core.cache import cache


class AssociateService:
    """
    Service for admin-level associate management operations.
    """

    async def get_all_associates(
        self, db: AsyncSession, skip: int = 0, limit: int = 100, q: str | None = None
    ) -> PaginatedData[AssociateRead]:
        """Get all associates with pagination."""
        # 0. Cache lookup
        cache_key = f"associates:list:{skip}:{limit}:{q or 'none'}"
        cached = await cache.get(cache_key)
        if cached:
            try:
                return PaginatedData[AssociateRead](
                    data=[AssociateRead.model_validate(d) for d in cached["data"]],
                    total=cached["total"]
                )
            except Exception:
                pass

        stmt = select(Associate)
        count_stmt = select(func.count(Associate.id))

        if q:
            search_filter = or_(
                Associate.name.ilike(f"%{q}%"),
                Associate.email.ilike(f"%{q}%"),
            )
            stmt = stmt.where(search_filter)
            count_stmt = count_stmt.where(search_filter)

        stmt = stmt.order_by(Associate.id.desc()).offset(skip).limit(limit)

        result = await db.execute(stmt)
        associates = result.scalars().all()
        total = await db.scalar(count_stmt) or 0

        res = PaginatedData[AssociateRead](
            data=[AssociateRead.model_validate(a) for a in associates],
            total=total,
        )

        # Cache the result (serialized)
        await cache.set(cache_key, {
            "data": [a.model_dump() for a in res.data],
            "total": res.total
        }, ttl=3600)

        return res

    async def get_associate_by_id(
        self, db: AsyncSession, associate_id: uuid.UUID
    ) -> AssociateRead:
        """Get an associate by ID."""
        cache_key = f"associate:{associate_id}"
        cached = await cache.get(cache_key)
        if cached:
            try:
                return AssociateRead.model_validate(cached)
            except Exception:
                pass

        associate = await associate_repository.crud.get(db=db, id=associate_id)
        if not associate:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Associate not found.",
            )

        res = AssociateRead.model_validate(associate)
        await cache.set(cache_key, res.model_dump(), ttl=3600)
        return res

    async def create_associate(
        self,
        db: AsyncSession,
        admin_user_id: uuid.UUID,
        associate_in: AssociateCreate,
    ) -> AssociateRead:
        """Create a new associate."""
        # 1. Check for existing associate email to prevent IntegrityError (case-insensitive)
        existing_query = select(Associate).where(func.lower(Associate.email) == func.lower(associate_in.email))
        existing_result = await db.execute(existing_query)
        if existing_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Associate with email '{associate_in.email}' already exists.",
            )

        associate = Associate(
            name=associate_in.name,
            email=associate_in.email,
        )
        db.add(associate)
        await db.commit()
        await db.refresh(associate)

        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="create_associate",
            target_type="associate",
            target_id=associate.id,
            details={
                "associate_id": str(associate.id),
                "name": associate.name,
                "email": associate.email,
            },
        )
        # Invalidate cache
        await cache.clear(pattern="associates:list:*")

        return AssociateRead.model_validate(associate)

    async def update_associate(
        self,
        db: AsyncSession,
        admin_user_id: uuid.UUID,
        associate_id: uuid.UUID,
        associate_update: AssociateUpdate,
    ) -> Associate | AssociateRead:
        """Update an associate."""
        # 1. Verify existence
        associate = await associate_repository.crud.get(db=db, id=associate_id)
        if not associate:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Associate not found.",
            )

        update_data = associate_update.model_dump(exclude_unset=True)
        if not update_data:
            return AssociateRead.model_validate(associate)

        # 2. If email is changing, check for uniqueness (case-insensitive)
        current_email = associate["email"] if isinstance(associate, dict) else associate.email
        if "email" in update_data and update_data["email"] != current_email:
            existing_query = select(Associate).where(func.lower(Associate.email) == func.lower(update_data["email"]))
            existing_result = await db.execute(existing_query)
            if existing_result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Associate with email '{update_data['email']}' already exists.",
                )

        # 3. Apply update
        updated = await associate_repository.crud.update(
            db=db,
            id=associate_id,
            object=update_data,
            schema_to_select=AssociateRead,
            return_as_model=True,
            one_or_none=True,
        )

        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="update_associate",
            target_type="associate",
            target_id=associate_id,
            details={
                "associate_id": str(associate_id),
                "name": updated.name,
                "updated_fields": list(update_data.keys())
            },
        )
        # Invalidate cache
        await cache.delete(f"associate:{associate_id}")
        await cache.clear(pattern="associates:list:*")

        return updated

    async def delete_associate(
        self, db: AsyncSession, admin_user_id: uuid.UUID, associate_id: uuid.UUID
    ) -> None:
        """Delete an associate."""
        associate = await self.get_associate_by_id(db=db, associate_id=associate_id)

        await associate_repository.crud.delete(db=db, id=associate_id)
        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="delete_associate",
            target_type="associate",
            target_id=associate_id,
            details={
                "associate_id": str(associate_id),
                "name": associate.name,
                "email": associate.email,
            },
        )
        # Invalidate cache
        await cache.delete(f"associate:{associate_id}")
        await cache.clear(pattern="associates:list:*")


associate_service = AssociateService()
