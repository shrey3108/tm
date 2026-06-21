import uuid
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.v1.db.models.tech_stacks import TechStack
from app.v1.schemas.tech_stack import TechStackCreate, TechStackUpdate
from app.v1.core.cache import cache

class TechStackService:
    async def get_all_tech_stacks(
        self, db: AsyncSession, skip: int = 0, limit: int = 100, search: str | None = None
    ):
        # 0. Cache lookup
        cache_key = f"tech_stacks:list:{skip}:{limit}:{search or 'none'}"
        cached = await cache.get(cache_key)
        if cached:
            return cached

        query = select(TechStack)
        if search:
            query = query.where(TechStack.name.ilike(f"%{search}%"))
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_query)).scalar() or 0
        
        # Get data
        query = query.offset(skip).limit(limit).order_by(TechStack.name.asc())
        result = await db.execute(query)
        data = result.scalars().all()
        
        from app.v1.schemas.tech_stack import TechStackRead
        res = {
            "data": [TechStackRead.model_validate(p).model_dump() for p in data],
            "total": total
        }
        await cache.set(cache_key, res, ttl=3600)
        return res

    async def get_tech_stack_by_id(self, db: AsyncSession, tech_stack_id: uuid.UUID) -> TechStack | None:
        return await db.get(TechStack, tech_stack_id)

    async def create_tech_stack(self, db: AsyncSession, user_id: uuid.UUID, tech_stack_in: TechStackCreate):
        # Check if exists
        check_stmt = select(TechStack).where(TechStack.name == tech_stack_in.name)
        if (await db.execute(check_stmt)).scalar():
            raise ValueError(f"TechStack '{tech_stack_in.name}' already exists")
            
        new_tech = TechStack(name=tech_stack_in.name, description=tech_stack_in.description)
        db.add(new_tech)
        await db.commit()
        await db.refresh(new_tech)
        
        # Invalidate cache
        await cache.clear(pattern="tech_stacks:list:*")
        
        return new_tech

    async def update_tech_stack(
        self, db: AsyncSession, user_id: uuid.UUID, tech_stack_id: uuid.UUID, tech_stack_in: TechStackUpdate
    ):
        tech = await db.get(TechStack, tech_stack_id)
        if not tech:
            return None
            
        if tech_stack_in.name:
            # Check for duplicates
            check_stmt = select(TechStack).where(
                TechStack.name == tech_stack_in.name, 
                TechStack.id != tech_stack_id
            )
            if (await db.execute(check_stmt)).scalar():
                raise ValueError(f"Another TechStack with name '{tech_stack_in.name}' already exists")
            tech.name = tech_stack_in.name
            
        if tech_stack_in.description is not None:
            tech.description = tech_stack_in.description
            
        await db.commit()
        await db.refresh(tech)
        
        # Invalidate cache
        await cache.clear(pattern="tech_stacks:list:*")
        
        return tech

    async def delete_tech_stack(self, db: AsyncSession, user_id: uuid.UUID, tech_stack_id: uuid.UUID):
        tech = await db.get(TechStack, tech_stack_id)
        if not tech:
            return False
            
        # Check if any job is using this tech stack (using the junction table)
        from app.v1.db.models.job_tech_stacks import job_tech_stacks
        job_check = await db.execute(
            select(job_tech_stacks.c.job_id)
            .where(job_tech_stacks.c.tech_stack_id == tech_stack_id)
            .limit(1)
        )
        if job_check.scalar():
            raise ValueError("Cannot delete TechStack because it is assigned to one or more jobs")
            
        await db.delete(tech)
        await db.commit()
        
        # Invalidate cache
        await cache.clear(pattern="tech_stacks:list:*")
        
        return True

tech_stack_service = TechStackService()
