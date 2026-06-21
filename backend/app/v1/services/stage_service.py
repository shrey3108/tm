"""
Stage Service Module (Facade).

Provides business logic for managing interview stages and templates.
Delegates to specialized services in the stage/ directory.
"""

from app.v1.db.models.job_stage_configs import JobStageConfig
from app.v1.db.models.stage_templates import StageTemplate
from app.v1.services.stage.job_stage_service import job_stage_service
from app.v1.services.stage.template_service import template_service


class StageService:
    """
    Facade service for stage template and job stage configuration business logic.
    """

    # --- Stage Template Methods ---

    async def get_all_templates(self, *args, **kwargs) -> list[StageTemplate]:
        return await template_service.get_all_templates(*args, **kwargs)

    async def get_template(self, *args, **kwargs) -> StageTemplate:
        return await template_service.get_template(*args, **kwargs)

    async def create_template(self, *args, **kwargs) -> StageTemplate:
        return await template_service.create_template(*args, **kwargs)

    async def update_template(self, *args, **kwargs) -> StageTemplate:
        return await template_service.update_template(*args, **kwargs)

    async def delete_template(self, *args, **kwargs) -> None:
        return await template_service.delete_template(*args, **kwargs)

    # --- Job Stage Config Methods ---

    async def get_job_stages(self, *args, **kwargs) -> list[JobStageConfig]:
        return await job_stage_service.get_job_stages(*args, **kwargs)

    async def add_stage_to_job(self, *args, **kwargs) -> JobStageConfig:
        return await job_stage_service.add_stage_to_job(*args, **kwargs)

    async def update_job_stage(self, *args, **kwargs) -> JobStageConfig:
        return await job_stage_service.update_job_stage(*args, **kwargs)

    async def remove_stage_from_job(self, *args, **kwargs) -> None:
        return await job_stage_service.remove_stage_from_job(*args, **kwargs)

    async def reorder_job_stages(self, *args, **kwargs) -> list[JobStageConfig]:
        return await job_stage_service.reorder_job_stages(*args, **kwargs)

    async def setup_default_stages(
        self, *args, **kwargs
    ) -> list[JobStageConfig]:
        return await job_stage_service.setup_default_stages(*args, **kwargs)

    async def bulk_setup_job_stages(
        self, *args, **kwargs
    ) -> list[JobStageConfig]:
        return await job_stage_service.bulk_add_stages_to_job(*args, **kwargs)


stage_service = StageService()
