import uuid
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.models.job_stage_configs import JobStageConfig
from app.v1.repository.stage_repository import stage_repository
from app.v1.schemas.job_stage import (
    JobStageConfigCreate,
    JobStageConfigUpdate,
)
from app.v1.services.stage.enrichment import enrich_stage_configs, prepare_config_for_save

class JobStageService:
    """
    Service for job stage configuration business logic.
    """

    async def get_job_stages(
        self, db: AsyncSession, job_id: uuid.UUID
    ) -> list[JobStageConfig]:
        """Retrieve the ordered interview stages for a job."""
        stages = await stage_repository.get_job_stages(db, job_id)
        await enrich_stage_configs(db, stages)
        return stages

    async def add_stage_to_job(
        self,
        db: AsyncSession,
        job_id: uuid.UUID,
        stage_in: JobStageConfigCreate,
    ) -> JobStageConfig:
        """Add a new stage to a job's interview process."""
        # Verify template exists
        template = await stage_repository.get_template_by_id(
            db, stage_in.template_id
        )
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stage template with ID {stage_in.template_id} not found",
            )

        # Merge template default config if not provided in stage_in
        config = stage_in.config or template.default_config
        config = prepare_config_for_save(config)

        # If this is set as default, clear other defaults for this job
        if stage_in.is_default:
            from sqlalchemy import update
            await db.execute(
                update(JobStageConfig)
                .where(JobStageConfig.job_id == job_id)
                .values(is_default=False)
            )

        stage_config = JobStageConfig(
            job_id=job_id,
            template_id=stage_in.template_id,
            stage_order=stage_in.stage_order,
            config=config,
            is_mandatory=stage_in.is_mandatory,
            is_default=stage_in.is_default,
        )
        created_stage = await stage_repository.create_job_stage(db, stage_config)
        await enrich_stage_configs(db, created_stage)
        return created_stage

    async def update_job_stage(
        self,
        db: AsyncSession,
        config_id: uuid.UUID,
        stage_update: JobStageConfigUpdate,
    ) -> JobStageConfig:
        """Update a specific job stage configuration."""
        stage_config = await stage_repository.get_stage_config_by_id(
            db, config_id
        )
        if not stage_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job stage configuration with ID {config_id} not found",
            )

        update_data = stage_update.model_dump(exclude_unset=True)
        if "config" in update_data:
            update_data["config"] = prepare_config_for_save(update_data["config"])
            
        # If setting as default, clear others
        if update_data.get("is_default"):
            from sqlalchemy import update
            await db.execute(
                update(JobStageConfig)
                .where(JobStageConfig.job_id == stage_config.job_id)
                .values(is_default=False)
            )

        updated_stage = await stage_repository.update_job_stage(
            db, stage_config, update_data
        )
        await enrich_stage_configs(db, updated_stage)
        return updated_stage

    async def remove_stage_from_job(
        self, db: AsyncSession, config_id: uuid.UUID
    ) -> None:
        """Remove a stage from a job's interview process."""
        stage_config = await stage_repository.get_stage_config_by_id(
            db, config_id
        )
        if not stage_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job stage configuration with ID {config_id} not found",
            )
        await stage_repository.delete_job_stage(db, stage_config)

    async def reorder_job_stages(
        self, db: AsyncSession, job_id: uuid.UUID, stage_ids: list[uuid.UUID]
    ) -> list[JobStageConfig]:
        """Bulk update the order of stages for a job."""
        stages = await stage_repository.get_job_stages(db, job_id)
        stage_map = {s.id: s for s in stages}

        # Validate all IDs belong to this job
        for sid in stage_ids:
            if sid not in stage_map:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Stage ID {sid} does not belong to job {job_id}",
                )

        # Update orders
        for index, sid in enumerate(stage_ids, start=1):
            await stage_repository.update_job_stage(
                db, stage_map[sid], {"stage_order": index}
            )

        return await stage_repository.get_job_stages(db, job_id)

    async def setup_default_stages(
        self, db: AsyncSession, job_id: uuid.UUID
    ) -> list[JobStageConfig]:
        """Setup the standard reference flow for a job based on default templates."""
        from sqlalchemy import select
        from app.v1.db.models.stage_templates import StageTemplate

        # Query for templates marked as default, ordered by their default_order
        stmt = (
            select(StageTemplate)
            .where(StageTemplate.is_default == True)
            .order_by(StageTemplate.default_order.asc())
        )
        default_templates = (await db.execute(stmt)).scalars().all()

        created_stages = []
        for index, template in enumerate(default_templates, start=1):
            stage_config = JobStageConfig(
                job_id=job_id,
                template_id=template.id,
                stage_order=template.default_order or index, # Use template order or fallback to sequence
                config=template.default_config,
                is_mandatory=True,
            )
            created_stages.append(
                await stage_repository.create_job_stage(db, stage_config)
            )

        await enrich_stage_configs(db, created_stages)
        return created_stages

    async def bulk_add_stages_to_job(
        self,
        db: AsyncSession,
        job_id: uuid.UUID,
        stages_in: list[JobStageConfigCreate],
    ) -> list[JobStageConfig]:
        """
        Synchronize stages for a job. 
        Tries to match existing stages to avoid deleting candidate history.
        """
        from sqlalchemy import delete
        
        # 1. Fetch current stages
        existing_stages = await stage_repository.get_job_stages(db, job_id)
        existing_map = {s.template_id: s for s in existing_stages} # Simple heuristic: map by template

        # 2. Track which existing stages we keep
        to_keep_ids = set()
        final_configs = []

        for index, s_in in enumerate(stages_in, start=1):
            template = await stage_repository.get_template_by_id(db, s_in.template_id)
            if not template:
                 raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Stage template with ID {s_in.template_id} not found",
                )
            
            # If this template is already in the job, update it instead of creating a new one
            if s_in.template_id in existing_map:
                existing_stage = existing_map[s_in.template_id]
                existing_stage.stage_order = s_in.stage_order or index
                existing_stage.is_mandatory = s_in.is_mandatory
                existing_stage.is_default = s_in.is_default
                if s_in.config is not None:
                    existing_stage.config = prepare_config_for_save(s_in.config)
                
                to_keep_ids.add(existing_stage.id)
                final_configs.append(existing_stage)
            else:
                # New stage to add
                new_stage = JobStageConfig(
                    job_id=job_id,
                    template_id=s_in.template_id,
                    stage_order=s_in.stage_order or index,
                    config=prepare_config_for_save(s_in.config or template.default_config),
                    is_mandatory=s_in.is_mandatory,
                    is_default=s_in.is_default
                )
                db.add(new_stage)
                final_configs.append(new_stage)

        # 3. Delete stages that are NOT in the new list
        for existing in existing_stages:
            if existing.id not in to_keep_ids:
                # WARNING: This will still delete candidate data for THIS specific stage
                await stage_repository.delete_job_stage(db, existing)

        await db.commit()
        
        # 4. Return refreshed list
        stages = await stage_repository.get_job_stages(db, job_id)
        await enrich_stage_configs(db, stages)
        return stages
        
        # 3. Return refreshed list
        stages = await stage_repository.get_job_stages(db, job_id)
        await enrich_stage_configs(db, stages)
        return stages

job_stage_service = JobStageService()
