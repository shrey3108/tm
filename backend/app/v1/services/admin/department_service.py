"""
Department service for admin-level department management.
"""

import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.models.departments import Department
from app.v1.db.models.jobs import Job
from app.v1.repository.department_repository import department_repository
from app.v1.schemas.department import DepartmentCreate, DepartmentRead, DepartmentUpdate
from app.v1.schemas.response import PaginatedData
from app.v1.services.admin.audit_service import audit_service
from app.v1.core.cache import cache


class DepartmentService:
    """
    Service for admin-level department management operations.
    """

    async def get_all_departments(
        self, db: AsyncSession, skip: int = 0, limit: int = 100, q: str | None = None
    ) -> PaginatedData[DepartmentRead]:
        """Get all departments with pagination."""
        # 0. Cache lookup
        cache_key = f"departments:list:{skip}:{limit}:{q or 'none'}"
        cached = await cache.get(cache_key)
        if cached:
            try:
                return PaginatedData[DepartmentRead](
                    data=[DepartmentRead.model_validate(d) for d in cached["data"]],
                    total=cached["total"]
                )
            except Exception:
                pass

        stmt = select(Department)
        count_stmt = select(func.count(Department.id))

        if q:
            search_filter = or_(
                Department.name.ilike(f"%{q}%"),
                Department.description.ilike(f"%{q}%"),
            )
            stmt = stmt.where(search_filter)
            count_stmt = count_stmt.where(search_filter)

        stmt = stmt.order_by(Department.id.desc()).offset(skip).limit(limit)

        result = await db.execute(stmt)
        departments = result.scalars().all()
        total = await db.scalar(count_stmt) or 0

        res = PaginatedData[DepartmentRead](
            data=[DepartmentRead.model_validate(d) for d in departments],
            total=total,
        )

        # Cache the result (serialized)
        await cache.set(cache_key, {
            "data": [d.model_dump() for d in res.data],
            "total": res.total
        }, ttl=3600)

        return res

    async def get_department_by_id(
        self, db: AsyncSession, department_id: uuid.UUID
    ) -> DepartmentRead:
        """Get a department by ID."""
        cache_key = f"department:{department_id}"
        cached = await cache.get(cache_key)
        if cached:
            try:
                return DepartmentRead.model_validate(cached)
            except Exception:
                pass

        department = await department_repository.crud.get(db=db, id=department_id)
        if not department:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found.",
            )
        
        res = DepartmentRead.model_validate(department)
        await cache.set(cache_key, res.model_dump(), ttl=3600)
        return res

    async def create_department(
        self,
        db: AsyncSession,
        admin_user_id: uuid.UUID,
        department_in: DepartmentCreate,
    ) -> DepartmentRead:
        """Create a new department."""
        # 1. Check for existing department name to prevent IntegrityError (case-insensitive)
        existing_dept_query = select(Department).where(func.lower(Department.name) == func.lower(department_in.name))
        existing_dept_result = await db.execute(existing_dept_query)
        if existing_dept_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Department with name '{department_in.name}' already exists.",
            )

        department = Department(
            name=department_in.name,
            description=department_in.description,
        )
        db.add(department)
        await db.commit()
        await db.refresh(department)

        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="create_department",
            target_type="department",
            target_id=department.id,
            details={
                "department_id": str(department.id),
                "name": department.name
            },
        )
        # Invalidate cache
        await cache.clear(pattern="departments:list:*")
        
        return DepartmentRead.model_validate(department)

    async def update_department(
        self,
        db: AsyncSession,
        admin_user_id: uuid.UUID,
        department_id: uuid.UUID,
        department_update: DepartmentUpdate,
    ) -> Department | DepartmentRead:
        """Update a department."""
        # 1. Verify existence
        department = await department_repository.crud.get(db=db, id=department_id)
        if not department:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found.",
            )

        update_data = department_update.model_dump(exclude_unset=True)
        if not update_data:
            return DepartmentRead.model_validate(department)

        # 2. If name is changing, check for uniqueness (case-insensitive)
        current_name = department["name"] if isinstance(department, dict) else department.name
        if "name" in update_data and update_data["name"] != current_name:
            existing_dept_query = select(Department).where(func.lower(Department.name) == func.lower(update_data["name"]))
            existing_dept_result = await db.execute(existing_dept_query)
            if existing_dept_result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Department with name '{update_data['name']}' already exists.",
                )

        # 3. Apply update
        updated = await department_repository.crud.update(
            db=db,
            id=department_id,
            object=update_data,
            schema_to_select=DepartmentRead,
            return_as_model=True,
            one_or_none=True,
        )
        
        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="update_department",
            target_type="department",
            target_id=department_id,
            details={
                "department_id": str(department_id),
                "name": updated.name,
                "updated_fields": list(update_data.keys())
            },
        )
        # Invalidate cache
        await cache.delete(f"department:{department_id}")
        await cache.clear(pattern="departments:list:*")
        
        return updated

    async def delete_department(
        self, db: AsyncSession, admin_user_id: uuid.UUID, department_id: uuid.UUID
    ) -> None:
        """Delete a department only if it is not used in any active job."""
        department = await self.get_department_by_id(db=db, department_id=department_id)

        active_jobs_stmt = (
            select(Job.title)
            .where(Job.department_id == department_id, Job.is_active.is_(True))
            .limit(5)
        )
        active_jobs_result = await db.execute(active_jobs_stmt)
        active_job_titles = [row[0] for row in active_jobs_result.fetchall()]

        active_jobs_count_stmt = select(func.count(Job.id)).where(
            Job.department_id == department_id,
            Job.is_active.is_(True),
        )
        active_jobs_count = await db.scalar(active_jobs_count_stmt) or 0

        if active_jobs_count > 0:
            jobs_text = ", ".join(active_job_titles)
            if active_jobs_count > 5:
                jobs_text += " and others"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Cannot delete department '{department.name}' because it is being used in {active_jobs_count} active job(s): [{jobs_text}]. "
                    "Please deactivate or reassign those jobs first."
                ),
            )

        await department_repository.crud.delete(db=db, id=department_id)
        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="delete_department",
            target_type="department",
            target_id=department_id,
            details={
                "department_id": str(department_id),
                "name": department.name
            },
        )
        # Invalidate cache
        await cache.delete(f"department:{department_id}")
        await cache.clear(pattern="departments:list:*")


department_service = DepartmentService()
