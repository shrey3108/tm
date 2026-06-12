import uuid
import re
from typing import List, Optional
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.v1.db.models.job_priorities import JobPriority
from app.v1.db.models.jobs import Job
from app.v1.schemas.job_priority import JobPriorityCreate, JobPriorityUpdate
from app.v1.services.admin.audit_service import audit_service
from app.v1.core.cache import cache


class JobPriorityService:
    async def get_all_priorities(
        self, 
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        search: str | None = None
    ) -> dict:
        # 0. Cache lookup
        cache_key = f"priorities:list:{skip}:{limit}:{search or 'none'}"
        cached = await cache.get(cache_key)
        if cached:
            return cached

        stmt = select(JobPriority)
        if search:
            stmt = stmt.where(JobPriority.name.ilike(f"%{search}%"))
        
        # Get total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = await db.scalar(count_stmt) or 0

        # Get paginated data with job counts
        stmt = (
            select(JobPriority, func.count(Job.id).label("job_count"))
            .outerjoin(Job, Job.priority_id == JobPriority.id)
            .group_by(JobPriority.id)
            .order_by(JobPriority.name)
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(stmt)
        rows = result.all()
        
        from app.v1.schemas.job_priority import JobPriorityRead
        data = []
        for p_obj, j_count in rows:
            # model_validate works on the ORM object
            p_read = JobPriorityRead.model_validate(p_obj)
            p_dict = p_read.model_dump()
            p_dict["assigned_jobs_count"] = j_count
            data.append(p_dict)

        res = {
            "data": data,
            "total": total
        }
        await cache.set(cache_key, res, ttl=3600)
        return res

    async def get_priority_by_id(self, db: AsyncSession, priority_id: uuid.UUID) -> Optional[JobPriority]:
        return await db.get(JobPriority, priority_id)

    async def create_priority(self, db: AsyncSession, admin_user_id: uuid.UUID, obj_in: JobPriorityCreate) -> JobPriority:
        # Auto-generate name (P1, P2, P3...)
        stmt = select(JobPriority.name)
        result = await db.execute(stmt)
        names = result.scalars().all()
        
        max_num = 0
        for name in names:
            match = re.match(r"P(\d+)", name)
            if match:
                num = int(match.group(1))
                if num > max_num:
                    max_num = num
        
        new_name = f"P{max_num + 1}"
        
        db_obj = JobPriority(
            name=new_name,
            **obj_in.model_dump()
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        
        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="create_priority",
            target_type="job_priority",
            target_id=db_obj.id,
            details={
                "priority_id": str(db_obj.id),
                "name": db_obj.name,
                "duration_days": db_obj.duration_days
            },
        )
        
        # Invalidate cache
        await cache.clear(pattern="priorities:list:*")
        
        return db_obj

    async def update_priority(self, db: AsyncSession, admin_user_id: uuid.UUID, priority_id: uuid.UUID, obj_in: JobPriorityUpdate) -> Optional[JobPriority]:
        db_obj = await self.get_priority_by_id(db, priority_id)
        if not db_obj:
            return None
        
        # Check for usage before updating - fetch job titles for clear error message
        usage_stmt = select(Job.title).where(Job.priority_id == priority_id).limit(5)
        usage_result = await db.execute(usage_stmt)
        job_titles = usage_result.scalars().all()
        if job_titles:
            jobs_list = ", ".join(f'"{t}"' for t in job_titles)
            raise ValueError(f"Priority '{db_obj.name}' cannot be edited because it is assigned to: {jobs_list}. Please reassign those jobs first.")

        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        
        await db.commit()
        await db.refresh(db_obj)

        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="update_priority",
            target_type="job_priority",
            target_id=db_obj.id,
            details={
                "priority_id": str(db_obj.id),
                "name": db_obj.name,
                "duration_days": db_obj.duration_days,
                "updated_fields": list(update_data.keys())
            },
        )
        
        # Invalidate cache
        await cache.clear(pattern="priorities:list:*")
        
        return db_obj

    async def delete_priority(self, db: AsyncSession, admin_user_id: uuid.UUID, priority_id: uuid.UUID) -> bool:
        db_obj = await self.get_priority_by_id(db, priority_id)
        if not db_obj:
            return False
        
        # Check if any jobs are using this priority - fetch titles for clear error message
        stmt = select(Job.title).where(Job.priority_id == priority_id).limit(5)
        result = await db.execute(stmt)
        job_titles = result.scalars().all()
        if job_titles:
            jobs_list = ", ".join(f'"{t}"' for t in job_titles)
            raise ValueError(f"Cannot delete priority '{db_obj.name}' because it is assigned to: {jobs_list}. Please reassign those jobs before deleting.")

        priority_name = db_obj.name
        await db.delete(db_obj)
        await db.commit()

        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="delete_priority",
            target_type="job_priority",
            target_id=priority_id,
            details={"name": priority_name},
        )
        
        # Invalidate cache
        await cache.clear(pattern="priorities:list:*")
        
        return True


job_priority_service = JobPriorityService()
