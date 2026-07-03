"""
Guideline service for admin-level guideline management.
"""

import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.models.guidelines import Guideline
from app.v1.repository.guideline_repository import guideline_repository
from app.v1.schemas.guideline import GuidelineCreate, GuidelineRead, GuidelineUpdate
from app.v1.schemas.response import PaginatedData
from app.v1.services.admin.audit_service import audit_service
from app.v1.core.cache import cache


class GuidelineService:
    """
    Service for admin-level guideline management operations.
    """

    async def get_all_guidelines(
        self, db: AsyncSession, skip: int = 0, limit: int = 100, q: str | None = None
    ) -> PaginatedData[GuidelineRead]:
        """Get all guidelines with pagination."""
        cache_key = f"guidelines:list:{skip}:{limit}:{q or 'none'}"
        cached = await cache.get(cache_key)
        if cached:
            try:
                return PaginatedData[GuidelineRead](
                    data=[GuidelineRead.model_validate(d) for d in cached["data"]],
                    total=cached["total"]
                )
            except Exception:
                pass

        stmt = select(Guideline)
        count_stmt = select(func.count(Guideline.id))

        if q:
            search_filter = Guideline.content.ilike(f"%{q}%")
            stmt = stmt.where(search_filter)
            count_stmt = count_stmt.where(search_filter)

        stmt = stmt.order_by(Guideline.id.desc()).offset(skip).limit(limit)

        result = await db.execute(stmt)
        guidelines = result.scalars().all()
        total = await db.scalar(count_stmt) or 0

        res = PaginatedData[GuidelineRead](
            data=[GuidelineRead.model_validate(g) for g in guidelines],
            total=total,
        )

        await cache.set(cache_key, {
            "data": [g.model_dump() for g in res.data],
            "total": res.total
        }, ttl=3600)

        return res

    async def get_guideline_by_id(
        self, db: AsyncSession, guideline_id: uuid.UUID
    ) -> GuidelineRead:
        """Get a guideline by ID."""
        cache_key = f"guideline:{guideline_id}"
        cached = await cache.get(cache_key)
        if cached:
            try:
                return GuidelineRead.model_validate(cached)
            except Exception:
                pass

        guideline = await db.scalar(select(Guideline).where(Guideline.id == guideline_id))
        if not guideline:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Guideline template not found.",
            )
        
        res = GuidelineRead.model_validate(guideline)
        await cache.set(cache_key, res.model_dump(), ttl=3600)
        return res

    async def create_guideline(
        self,
        db: AsyncSession,
        admin_user_id: uuid.UUID,
        guideline_in: GuidelineCreate,
    ) -> GuidelineRead:
        """Create a new guideline template."""
        # Uniqueness check on content
        existing = await db.scalar(select(Guideline).where(Guideline.content == guideline_in.content))
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Guideline with this content already exists.",
            )

        guideline_db = Guideline(content=guideline_in.content)
        db.add(guideline_db)
        await db.commit()
        await db.refresh(guideline_db)
        
        # Extract fields needed for audit log before committing again
        target_id = guideline_db.id
        content = guideline_db.content

        await cache.clear(pattern="guidelines:list:*")

        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="create_guideline",
            target_type="guideline",
            target_id=target_id,
            details={
                "content": content,
            },
        )

        await db.refresh(guideline_db)
        return GuidelineRead.model_validate(guideline_db)

    async def update_guideline(
        self,
        db: AsyncSession,
        admin_user_id: uuid.UUID,
        guideline_id: uuid.UUID,
        guideline_update: GuidelineUpdate,
    ) -> GuidelineRead:
        """Update an existing guideline template."""
        guideline = await db.scalar(select(Guideline).where(Guideline.id == guideline_id))
        if not guideline:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Guideline template not found.",
            )

        # Uniqueness check on content if updated
        if guideline_update.content and guideline_update.content != guideline.content:
            existing = await db.scalar(select(Guideline).where(Guideline.content == guideline_update.content))
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Guideline with this content already exists.",
                )

        if guideline_update.content is not None:
            guideline.content = guideline_update.content

        await db.commit()
        await db.refresh(guideline)

        await cache.delete(f"guideline:{guideline_id}")
        await cache.clear(pattern="guidelines:list:*")

        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="update_guideline",
            target_type="guideline",
            target_id=guideline_id,
            details=guideline_update.model_dump(exclude_unset=True),
        )

        await db.refresh(guideline)
        return GuidelineRead.model_validate(guideline)

    async def delete_guideline(
        self, db: AsyncSession, admin_user_id: uuid.UUID, guideline_id: uuid.UUID
    ) -> None:
        """Delete a guideline template."""
        guideline = await db.scalar(select(Guideline).where(Guideline.id == guideline_id))
        if not guideline:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Guideline template not found.",
            )

        content = guideline.content
        
        await db.delete(guideline)
        await db.commit()

        await cache.delete(f"guideline:{guideline_id}")
        await cache.clear(pattern="guidelines:list:*")

        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="delete_guideline",
            target_type="guideline",
            target_id=guideline_id,
            details={"content": content},
        )


guideline_service = GuidelineService()
