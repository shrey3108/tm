import uuid
from typing import List, Optional
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.v1.db.models.job_positions import JobPosition
from app.v1.schemas.job_position import JobPositionCreate, JobPositionUpdate
from app.v1.core.cache import cache

class JobPositionService:
    async def get_all_positions(
        self, db: AsyncSession, skip: int = 0, limit: int = 100, search: str | None = None
    ):
        # 0. Cache lookup
        cache_key = f"positions:list:{skip}:{limit}:{search or 'none'}"
        cached = await cache.get(cache_key)
        if cached:
            return cached

        query = select(JobPosition)
        if search:
            query = query.where(JobPosition.name.ilike(f"%{search}%"))
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_query)).scalar() or 0
        
        # Get data
        query = query.offset(skip).limit(limit).order_by(JobPosition.name.asc())
        result = await db.execute(query)
        data = result.scalars().all()
        
        from app.v1.schemas.job_position import JobPositionRead
        res = {
            "data": [JobPositionRead.model_validate(p).model_dump() for p in data],
            "total": total
        }
        await cache.set(cache_key, res, ttl=3600)
        return res

    async def create_position(self, db: AsyncSession, user_id: uuid.UUID, position_in: JobPositionCreate):
        # Check if exists
        check_stmt = select(JobPosition).where(JobPosition.name == position_in.name)
        if (await db.execute(check_stmt)).scalar():
            raise ValueError(f"Position '{position_in.name}' already exists")
            
        new_pos = JobPosition(name=position_in.name)
        db.add(new_pos)
        await db.commit()
        await db.refresh(new_pos)
        
        # Invalidate cache
        await cache.clear(pattern="positions:list:*")
        
        return new_pos

    async def update_position(
        self, db: AsyncSession, user_id: uuid.UUID, position_id: uuid.UUID, position_in: JobPositionUpdate
    ):
        pos = await db.get(JobPosition, position_id)
        if not pos:
            return None
            
        if position_in.name:
            # Check for duplicates
            check_stmt = select(JobPosition).where(
                JobPosition.name == position_in.name, 
                JobPosition.id != position_id
            )
            if (await db.execute(check_stmt)).scalar():
                raise ValueError(f"Another position with name '{position_in.name}' already exists")
            pos.name = position_in.name
            
        await db.commit()
        await db.refresh(pos)
        
        # Invalidate cache
        await cache.clear(pattern="positions:list:*")
        
        return pos

    async def delete_position(self, db: AsyncSession, user_id: uuid.UUID, position_id: uuid.UUID):
        pos = await db.get(JobPosition, position_id)
        if not pos:
            return False
            
        # Check if any job is using this position
        from app.v1.db.models.jobs import Job
        job_check = await db.execute(select(Job.id).where(Job.position_id == position_id).limit(1))
        if job_check.scalar():
            raise ValueError("Cannot delete position because it is assigned to one or more jobs")
            
        await db.delete(pos)
        await db.commit()
        
        # Invalidate cache
        await cache.clear(pattern="positions:list:*")
        
        return True

job_position_service = JobPositionService()
