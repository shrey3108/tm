from typing import Any
import uuid
from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.models.skills import Skill
from app.v1.db.models.jobs import Job
from app.v1.db.models.job_skills import job_skills
from app.v1.db.models.candidate_skills import candidate_skills
from app.v1.repository.skill_repository import skill_repository
from app.v1.schemas.skill import SkillCreate, SkillRead, SkillUpdate
from app.v1.schemas.response import PaginatedData
from app.v1.services.admin.audit_service import audit_service
from app.v1.core.cache import cache

class SkillService:
    """
    Service for admin-level skill management operations.
    """

    async def get_all_skills(
        self, db: AsyncSession, skip: int = 0, limit: int = 100, search: str | None = None
    ) -> PaginatedData[SkillRead]:
        """Get all skills with pagination and optional search."""
        # 0. Cache lookup
        cache_key = f"skills:list:{skip}:{limit}:{search or 'none'}"
        cached = await cache.get(cache_key)
        if cached:
            try:
                return PaginatedData[SkillRead](
                    data=[SkillRead.model_validate(s) for s in cached["data"]],
                    total=cached["total"]
                )
            except Exception:
                pass

        from sqlalchemy import func, or_
        stmt = select(Skill)
        count_stmt = select(func.count(Skill.id))

        if search:
            search_filter = or_(
                Skill.name.ilike(f"%{search}%"),
                Skill.description.ilike(f"%{search}%"),
            )
            stmt = stmt.where(search_filter)
            count_stmt = count_stmt.where(search_filter)

        stmt = stmt.order_by(Skill.id.desc()).offset(skip).limit(limit)

        result = await db.execute(stmt)
        skills = result.scalars().all()
        total = await db.scalar(count_stmt) or 0

        res = PaginatedData[SkillRead](
            data=[SkillRead.model_validate(s) for s in skills],
            total=total,
        )
        
        # Cache the result (serialized)
        await cache.set(cache_key, {
            "data": [s.model_dump() for s in res.data],
            "total": res.total
        }, ttl=3600) # 1 hour for skills, they don't change often
        
        return res

    async def get_skill_by_id(
        self, db: AsyncSession, skill_id: uuid.UUID
    ) -> SkillRead:
        """Get a skill by ID."""
        cache_key = f"skill:{skill_id}"
        cached = await cache.get(cache_key)
        if cached:
            try:
                return SkillRead.model_validate(cached)
            except Exception:
                pass

        skill = await skill_repository.crud.get(db=db, id=skill_id)
        if not skill:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Skill not found.",
            )
        
        res = SkillRead.model_validate(skill)
        await cache.set(cache_key, res.model_dump(), ttl=3600)
        return res

    async def create_skill(
        self, db: AsyncSession, admin_user_id: uuid.UUID, skill_in: SkillCreate
    ) -> SkillRead:
        """Create a new skill."""
        # 1. Check for existing skill name to prevent IntegrityError (case-insensitive)
        from sqlalchemy import func
        existing_skill_query = select(Skill).where(func.lower(Skill.name) == func.lower(skill_in.name))
        existing_skill_result = await db.execute(existing_skill_query)
        if existing_skill_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Skill with name '{skill_in.name}' already exists.",
            )

        skill = Skill(
            name=skill_in.name,
            description=skill_in.description,
        )
        db.add(skill)
        await db.commit()
        await db.refresh(skill)

        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="create_skill",
            target_type="skill",
            target_id=skill.id,
            details={
                "skill_id": str(skill.id),
                "name": skill.name
            },
        )
        # Invalidate cache
        await cache.clear(pattern="skills:list:*")
        
        return SkillRead.model_validate(skill)

    async def update_skill(
        self,
        db: AsyncSession,
        admin_user_id: uuid.UUID,
        skill_id: uuid.UUID,
        skill_update: SkillUpdate,
    ) -> Skill | SkillRead:
        """Update a skill."""
        # 1. Verify existence
        skill = await skill_repository.crud.get(db=db, id=skill_id)
        if not skill:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Skill not found.",
            )
            
        update_data = skill_update.model_dump(exclude_unset=True)
        if not update_data:
            return SkillRead.model_validate(skill)

        # 2. If name is changing, check for uniqueness (case-insensitive)
        current_name = skill["name"] if isinstance(skill, dict) else skill.name
        if "name" in update_data and update_data["name"] != current_name:
            from sqlalchemy import func
            existing_skill_query = select(Skill).where(func.lower(Skill.name) == func.lower(update_data["name"]))
            existing_skill_result = await db.execute(existing_skill_query)
            if existing_skill_result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Skill with name '{update_data['name']}' already exists.",
                )

        # 3. Apply update
        updated_skill = await skill_repository.crud.update(
            db=db,
            id=skill_id,
            object=update_data,
            schema_to_select=SkillRead,
            return_as_model=True,
            one_or_none=True,
        )
        
        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="update_skill",
            target_type="skill",
            target_id=skill_id,
            details={
                "skill_id": str(skill_id),
                "updated_fields": list(update_data.keys())
            },
        )
        # Invalidate cache
        await cache.delete(f"skill:{skill_id}")
        await cache.clear(pattern="skills:list:*")
        
        return updated_skill

    async def delete_skill(
        self, db: AsyncSession, admin_user_id: uuid.UUID, skill_id: uuid.UUID
    ) -> None:
        """Delete a skill after safety checks and cleaning associations."""
        # 1. Fetch Skill to verify existence and get details
        skill = await skill_repository.crud.get(db=db, id=skill_id)
        if not skill:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Skill not found.",
            )
        
        # Safe attribute access as requested
        skill_name = skill.name if hasattr(skill, 'name') else skill.get('name', "Unknown Skill")

        # 2. Safety Check: Is it being used in any ACTIVE Jobs?
        # Fetch Job Titles for better error message
        active_jobs_query = (
            select(Job.title)
            .join(job_skills, Job.id == job_skills.c.job_id)
            .where(job_skills.c.skill_id == skill_id, Job.is_active == True)
        )
        result = await db.execute(active_jobs_query)
        active_job_titles = [row[0] for row in result.fetchall()]

        if active_job_titles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete skill '{skill_name}' because it is being used in ACTIVE Job(s): {active_job_titles}. Please deactivate these Job(s) first."
            )

        # 3. Clean Linkage: Cascade delete associations from junction tables
        # Required to satisfy Foreign Key constraints
        await db.execute(delete(job_skills).where(job_skills.c.skill_id == skill_id))
        await db.execute(delete(candidate_skills).where(candidate_skills.c.skill_id == skill_id))

        # 4. Final Deletion: Delete the skill itself
        await skill_repository.crud.delete(db=db, id=skill_id)
        await db.commit()

        # 5. Audit Log
        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="delete_skill",
            target_type="skill",
            target_id=skill_id,
            details={
                "skill_id": str(skill_id),
                "name": skill_name
            }
        )
        # Invalidate cache
        await cache.delete(f"skill:{skill_id}")
        await cache.clear(pattern="skills:list:*")

skill_service = SkillService()
