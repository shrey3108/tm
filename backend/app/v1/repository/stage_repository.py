"""
Stage Repository Module.

Provides data access layer for stage templates and job stage configurations.
"""

import uuid

from sqlalchemy import delete, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.v1.db.models.job_stage_configs import JobStageConfig
from app.v1.db.models.stage_templates import StageTemplate


class StageRepository:
    """
    Repository for stage template and job stage configuration database operations.
    """

    # --- Stage Template CRUD ---

    async def get_all_templates(
        self, 
        db: AsyncSession, 
        skip: int = 0, 
        limit: int = 100, 
        search: str | None = None
    ) -> tuple[list[StageTemplate], int]:
        """Retrieve all stage templates with pagination and search."""
        stmt = select(StageTemplate)
        if search:
            stmt = stmt.where(
                StageTemplate.name.ilike(f"%{search}%") | 
                StageTemplate.description.ilike(f"%{search}%")
            )
        
        # Get total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = await db.scalar(count_stmt) or 0

        # Get paginated data
        stmt = stmt.order_by(StageTemplate.name).offset(skip).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all()), total

    async def get_template_by_id(
        self, db: AsyncSession, template_id: uuid.UUID
    ) -> StageTemplate | None:
        """Retrieve a stage template by its unique identifier."""
        return await db.get(StageTemplate, template_id)

    async def get_template_by_name(
        self, db: AsyncSession, name: str
    ) -> StageTemplate | None:
        """Retrieve a stage template by its exact name (case-insensitive)."""
        stmt = select(StageTemplate).where(func.lower(StageTemplate.name) == name.lower())
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_template(
        self, db: AsyncSession, template_in: StageTemplate
    ) -> StageTemplate:
        """Create a new stage template."""
        db.add(template_in)
        await db.commit()
        await db.refresh(template_in)
        return template_in

    async def update_template(
        self, db: AsyncSession, template: StageTemplate, update_data: dict
    ) -> StageTemplate:
        """Update a stage template."""
        for key, value in update_data.items():
            if value is not None:
                setattr(template, key, value)
        await db.commit()
        await db.refresh(template)
        return template

    async def delete_template(
        self, db: AsyncSession, template: StageTemplate
    ) -> None:
        """Delete a stage template."""
        await db.delete(template)
        await db.commit()

    async def count_template_usage(
        self, db: AsyncSession, template_id: uuid.UUID
    ) -> int:
        """Count how many job stage configurations are using this template."""
        stmt = select(func.count(JobStageConfig.id)).where(
            JobStageConfig.template_id == template_id
        )
        result = await db.execute(stmt)
        return result.scalar() or 0

    # --- Job Stage Config CRUD ---

    async def get_job_stages(
        self, db: AsyncSession, job_id: uuid.UUID
    ) -> list[JobStageConfig]:
        """Retrieve all stage configurations for a specific job."""
        result = await db.execute(
            select(JobStageConfig)
            .where(JobStageConfig.job_id == job_id)
            .options(selectinload(JobStageConfig.template))
            .order_by(JobStageConfig.stage_order)
        )
        return list(result.scalars().all())

    async def get_stage_config_by_id(
        self, db: AsyncSession, config_id: uuid.UUID
    ) -> JobStageConfig | None:
        """Retrieve a job stage configuration by its ID."""
        return await db.get(JobStageConfig, config_id)

    async def create_job_stage(
        self, db: AsyncSession, stage_in: JobStageConfig
    ) -> JobStageConfig:
        """Add a stage configuration to a job."""
        db.add(stage_in)
        await db.commit()
        await db.refresh(stage_in)
        # Re-fetch with template info
        result = await db.execute(
            select(JobStageConfig)
            .where(JobStageConfig.id == stage_in.id)
            .options(selectinload(JobStageConfig.template))
        )
        return result.scalar_one()

    async def update_job_stage(
        self, db: AsyncSession, stage_config: JobStageConfig, update_data: dict
    ) -> JobStageConfig:
        """Update a job-specific stage configuration."""
        for key, value in update_data.items():
            if value is not None:
                setattr(stage_config, key, value)
        await db.commit()
        
        # Re-fetch with template info to satisfy response schema
        result = await db.execute(
            select(JobStageConfig)
            .where(JobStageConfig.id == stage_config.id)
            .options(selectinload(JobStageConfig.template))
        )
        return result.scalar_one()

    async def delete_job_stage(
        self, db: AsyncSession, stage_config: JobStageConfig
    ) -> None:
        """Remove a stage configuration from a job."""
        await db.delete(stage_config)
        await db.commit()

    async def clear_job_stages(
        self, db: AsyncSession, job_id: uuid.UUID
    ) -> None:
        """Remove all stage configurations for a specific job."""
        await db.execute(
            delete(JobStageConfig).where(JobStageConfig.job_id == job_id)
        )
        await db.commit()


stage_repository = StageRepository()
