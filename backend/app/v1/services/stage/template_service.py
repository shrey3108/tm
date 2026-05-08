import uuid
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.models.stage_templates import StageTemplate
from app.v1.repository.stage_repository import stage_repository
from app.v1.schemas.job_stage import (
    StageTemplateCreate,
    StageTemplateUpdate,
)
from app.v1.services.stage.enrichment import enrich_stage_configs, prepare_config_for_save
from app.v1.core.cache import cache
from app.v1.services.admin.audit_service import audit_service

class StageTemplateService:
    """
    Service for stage template business logic.
    """

    async def get_all_templates(
        self, 
        db: AsyncSession, 
        skip: int = 0, 
        limit: int = 100, 
        search: str | None = None
    ) -> dict:
        """Retrieve all available stage templates with pagination and search."""
        # 0. Cache lookup
        cache_key = f"stage_templates:list:{skip}:{limit}:{search or 'none'}"
        cached = await cache.get(cache_key)
        if cached:
            return cached

        templates, total = await stage_repository.get_all_templates(
            db, skip=skip, limit=limit, search=search
        )
        # Enrich templates with criteria names
        await enrich_stage_configs(db, templates)
        
        serializable_data = []
        from app.v1.schemas.job_stage import StageTemplateRead
        for t in templates:
            serializable_data.append(StageTemplateRead.model_validate(t).model_dump(by_alias=True))
            
        final_res = {"data": serializable_data, "total": total}
        await cache.set(cache_key, final_res, ttl=3600)
        return final_res

    async def create_template(
        self, db: AsyncSession, admin_user_id: uuid.UUID, template_in: StageTemplateCreate
    ) -> StageTemplate:
        """Create a new stage template."""
        template = StageTemplate(
            name=template_in.name,
            description=template_in.description,
            default_config=prepare_config_for_save(template_in.config),
        )
        template = await stage_repository.create_template(db, template)
        await enrich_stage_configs(db, template)

        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="create_stage_template",
            target_type="stage_template",
            target_id=template.id,
            details={
                "template_id": str(template.id),
                "name": template.name
            },
        )
        
        # Invalidate cache
        await cache.clear(pattern="stage_templates:list:*")
        
        return template

    async def update_template(
        self,
        db: AsyncSession,
        admin_user_id: uuid.UUID,
        template_id: uuid.UUID,
        template_update: StageTemplateUpdate,
    ) -> StageTemplate:
        """Update an existing stage template."""
        template = await stage_repository.get_template_by_id(db, template_id)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stage template with ID {template_id} not found",
            )

        update_data = template_update.model_dump(exclude_unset=True)
        # Handle the default_config/config mapping
        if "config" in update_data:
            update_data["default_config"] = prepare_config_for_save(update_data.pop("config"))
            
        updated_template = await stage_repository.update_template(db, template, update_data)
        await enrich_stage_configs(db, updated_template)

        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="update_stage_template",
            target_type="stage_template",
            target_id=template_id,
            details={
                "template_id": str(template_id),
                "name": updated_template.name,
                "updated_fields": list(update_data.keys())
            },
        )
        
        # Invalidate cache
        await cache.clear(pattern="stage_templates:list:*")
        
        return updated_template

    async def delete_template(
        self, db: AsyncSession, admin_user_id: uuid.UUID, template_id: uuid.UUID
    ) -> None:
        """Delete a stage template. Prevents deletion if assigned to any job."""
        template = await stage_repository.get_template_by_id(db, template_id)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stage template with ID {template_id} not found",
            )
            
        # Check if template is assigned to any job
        usage_count = await stage_repository.count_template_usage(db, template_id)
        if usage_count > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot delete template '{template.name}' as it is currently assigned to {usage_count} job(s)."
            )
            
        template_name = template.name
        await stage_repository.delete_template(db, template)
        
        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="delete_stage_template",
            target_type="stage_template",
            target_id=template_id,
            details={
                "template_id": str(template_id),
                "name": template_name
            },
        )
        
        # Invalidate cache
        await cache.clear(pattern="stage_templates:list:*")

template_service = StageTemplateService()
