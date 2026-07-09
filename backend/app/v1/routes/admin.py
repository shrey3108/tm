"""
Admin routes module.

This module provides admin endpoints for user management, role management,
permission management, audit logs, analytics, and hiring reports.
"""

import uuid
from typing import Any

from app.v1.core.logging import get_logger
from app.v1.db.session import get_db
from app.v1.dependencies import check_permission
from app.v1.schemas.admin import (
    AnalyticsSummary,
    AuditLogRead,
    HiringReport,
    JobPipelineStats,
    PermissionCreate,
    PermissionRead,
    RecentUploadRead,
    RoleCreate,
    RoleRead,
    RoleUpdate,
    RoleWithPermissions,
    UserAdminCreate,
    UserAdminRead,
    UserAdminUpdate,
)
from app.v1.schemas.job_stage import (
    StageTemplateCreate,
    StageTemplateRead,
    StageTemplateUpdate,
)
from app.v1.schemas.response import PaginatedData
from app.v1.schemas.user import UserRead
from app.v1.schemas.prompt import PromptsList, PromptRead
from app.v1.schemas.criteria import CriterionRead, CriterionCreate, CriterionUpdate, CriterionEnhanceRequest, CriterionEnhanceResponse, CriterionVersionRead
from app.v1.db.models.criteria import Criterion
from sqlalchemy import select, func
from fastapi import HTTPException
from app.v1.prompts import (
    RESUME_JD_ANALYSIS_PROMPT,
    RESUME_EXTRACTION_PROMPT,
    JD_INSTRUCTION,
    RESUME_INSTRUCTION,
    SKILL_INSTRUCTION,
    EVALUATION_SYSTEM_PROMPT,
    EVALUATION_USER_PROMPT_TEMPLATE,
    PROMPT_ENHANCER_SYSTEM_PROMPT,
    PROMPT_ENHANCER_USER_PROMPT_TEMPLATE,
)
from app.v1.services.admin_service import admin_service
from app.v1.services.stage_service import stage_service
from app.v1.services.prompt_enhancer_service import prompt_enhancer_service
import asyncio
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.v1.core.cache import cache

logger = get_logger(__name__)

router = APIRouter()
"""API Router for admin endpoints.

Provides endpoints for user management, role management, permission management,
audit logs, analytics, and hiring reports. All endpoints require admin authentication.
"""


@router.get("/users", response_model=PaginatedData[UserAdminRead])
async def get_all_users(
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("users:read")),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: str | None = Query(None),
) -> Any:
    """Get all users."""
    return await admin_service.get_all_users(db=db, skip=skip, limit=limit, q=q)


@router.post(
    "/users", response_model=UserAdminRead, status_code=status.HTTP_201_CREATED
)
async def create_user(
    *,
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("users:manage")),
    user_in: UserAdminCreate,
) -> Any:
    """Create a new user."""
    return await admin_service.create_user(
        db=db, admin_user_id=admin.id, user_in=user_in
    )


@router.get("/users/{user_id}", response_model=UserAdminRead)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("users:read")),
) -> Any:
    """Get a specific user by ID."""
    return await admin_service.get_user_by_id(db=db, user_id=user_id)


@router.patch("/users/{user_id}", response_model=UserAdminRead)
async def update_user(
    user_id: uuid.UUID,
    *,
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("users:manage")),
    user_update: UserAdminUpdate,
) -> Any:
    """Update a user."""
    return await admin_service.update_user(
        db=db, admin_user_id=admin.id, user_id=user_id, user_update=user_update
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("users:manage")),
) -> None:
    """Delete a user."""
    await admin_service.delete_user(db=db, admin_user_id=admin.id, user_id=user_id)


@router.get("/roles", response_model=PaginatedData[RoleRead])
async def get_all_roles(
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("roles:read")),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: str | None = Query(None),
) -> Any:
    """Get all roles with optional search."""
    return await admin_service.get_all_roles(db=db, skip=skip, limit=limit, search=q)


@router.post(
    "/roles",
    response_model=RoleWithPermissions,
    status_code=status.HTTP_201_CREATED,
)
async def create_role(
    *,
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("roles:manage")),
    role_in: RoleCreate,
) -> Any:
    """Create a new role."""
    return await admin_service.create_role(
        db=db, admin_user_id=admin.id, role_in=role_in
    )


@router.get("/roles/{role_id}", response_model=RoleWithPermissions)
async def get_role(
    role_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("roles:read")),
) -> Any:
    """Get a specific role by ID."""
    return await admin_service.get_role_by_id(db=db, role_id=role_id)


@router.patch("/roles/{role_id}", response_model=RoleWithPermissions)
async def update_role(
    role_id: uuid.UUID,
    *,
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("roles:manage")),
    role_update: RoleUpdate,
) -> Any:
    """Update a role."""
    return await admin_service.update_role(
        db=db, admin_user_id=admin.id, role_id=role_id, role_update=role_update
    )


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("roles:manage")),
) -> None:
    """Delete a role."""
    await admin_service.delete_role(db=db, admin_user_id=admin.id, role_id=role_id)


@router.get("/permissions", response_model=PaginatedData[PermissionRead])
async def get_all_permissions(
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("permissions:read")),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
) -> Any:
    """Get all permissions."""
    return await admin_service.get_all_permissions(db=db, skip=skip, limit=limit)


@router.post(
    "/permissions",
    response_model=PermissionRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_permission(
    *,
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("permissions:manage")),
    permission_in: PermissionCreate,
) -> Any:
    """Create a new permission."""
    return await admin_service.create_permission(
        db=db, admin_user_id=admin.id, permission_in=permission_in
    )


@router.delete("/permissions/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_permission(
    permission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("permissions:manage")),
) -> None:
    """Delete a permission."""
    await admin_service.delete_permission(
        db=db, admin_user_id=admin.id, permission_id=permission_id
    )


@router.get("/audit-logs", response_model=PaginatedData[AuditLogRead])
async def get_audit_logs(
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("audit:read")),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: str | None = Query(None),
) -> Any:
    """Get all audit logs, optionally filtered by action."""
    return await admin_service.get_audit_logs(db=db, skip=skip, limit=limit, q=q)


@router.get("/recent-uploads", response_model=PaginatedData[RecentUploadRead])
async def get_recent_uploads(
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("files:read")),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    q: str | None = Query(None),
) -> Any:
    """Get recent file uploads, optionally filtered by file name."""
    return await admin_service.get_recent_uploads(db=db, skip=skip, limit=limit, q=q)


@router.get("/analytics", response_model=AnalyticsSummary)
async def get_analytics(
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("analytics:read")),
) -> Any:
    """Get analytics summary."""
    return await admin_service.get_analytics_summary(db=db)


@router.get("/hiring-report", response_model=HiringReport)
async def get_hiring_report(
    job_id: uuid.UUID | None = Query(default=None, description="Filter pipeline_stats to a specific job"),
    stage_name: str | None = Query(default=None, description="Filter pipeline_stats to a specific stage name"),
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("analytics:read")),
) -> Any:
    """Get hiring report with detailed statistics.

    Optional filters (only affect `job_pipeline_stats` field):
    - **job_id**: restrict pipeline stats to one job.
    - **stage_name**: restrict pipeline stats to one stage name (e.g. `Resume Screening`).
    """
    return await admin_service.get_hiring_report(
        db=db, job_id=job_id, stage_name=stage_name
    )


@router.get("/pipeline-stats", response_model=list[dict])
async def get_pipeline_stats(
    job_id: uuid.UUID | None = Query(default=None, description="Filter by a specific job UUID"),
    stage_name: str | None = Query(default=None, description="Filter by stage name (e.g. 'HR Screening Round')"),
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("analytics:read")),
) -> Any:
    """
    Get pipeline completion stats per job/stage.

    - **job_id**: (optional) restrict results to one job.
    - **stage_name**: (optional) return only a specific stage across all (or the filtered) jobs.
    """
    return await admin_service.get_pipeline_stats(
        db=db, job_id=job_id, stage_name=stage_name
    )


# --- Stage Template Management ---


@router.get("/stage-templates", response_model=PaginatedData[StageTemplateRead])
async def get_stage_templates(
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("jobs:access")),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: str | None = Query(None),
) -> Any:
    """Get all stage templates with pagination and search."""
    return await stage_service.get_all_templates(
        db=db, skip=skip, limit=limit, search=q
    )


@router.get("/stage-templates/{template_id}", response_model=StageTemplateRead)
async def get_stage_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("jobs:access")),
) -> Any:
    """Get a specific stage template by ID."""
    return await stage_service.get_template(db=db, template_id=template_id)


@router.post(
    "/stage-templates",
    response_model=StageTemplateRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_stage_template(
    *,
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("jobs:manage")),
    template_in: StageTemplateCreate,
) -> Any:
    """Create a new stage template."""
    return await stage_service.create_template(
        db=db, admin_user_id=admin.id, template_in=template_in
    )


@router.patch("/stage-templates/{template_id}", response_model=StageTemplateRead)
async def update_stage_template(
    template_id: uuid.UUID,
    *,
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("jobs:manage")),
    template_update: StageTemplateUpdate,
) -> Any:
    """Update a stage template."""
    return await stage_service.update_template(
        db=db,
        admin_user_id=admin.id,
        template_id=template_id,
        template_update=template_update,
    )


@router.delete("/stage-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stage_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("jobs:manage")),
) -> None:
    """Delete a stage template."""
    await stage_service.delete_template(
        db=db, admin_user_id=admin.id, template_id=template_id
    )


@router.get("/prompts", response_model=PaginatedData[PromptRead])
async def get_active_prompts(
    admin: UserRead = Depends(check_permission("analytics:read")),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: str | None = Query(None),
) -> Any:
    """
    Get all AI prompts currently in use by the system (Read-only), with optional search and pagination.
    """
    # 0. Cache lookup
    cache_key = f"prompts:list:{skip}:{limit}:{q or 'none'}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    prompts = [
        {
            "name": "Resume Extraction Prompt",
            "content": RESUME_EXTRACTION_PROMPT,
            "stage": "Resume Screening",
        },
        {
            "name": "Resume-JD Analysis Prompt",
            "content": RESUME_JD_ANALYSIS_PROMPT,
            "stage": "Resume Screening",
        },
        {
            "name": "JD Processing Instruction",
            "content": JD_INSTRUCTION,
            "stage": "Resume Screening",
        },
        {
            "name": "Resume Processing Instruction",
            "content": RESUME_INSTRUCTION,
            "stage": "Resume Screening",
        },
        {
            "name": "Skill Extraction Instruction",
            "content": SKILL_INSTRUCTION,
            "stage": "Resume Screening",
        },
        {
            "name": "Interview Evaluation System Prompt",
            "content": EVALUATION_SYSTEM_PROMPT,
            "stage": "HR Screening Round",
        },
        {
            "name": "Interview Evaluation User Prompt Template",
            "content": EVALUATION_USER_PROMPT_TEMPLATE,
            "stage": "HR Screening Round",
        },
    ]

    if q:
        q_lower = q.lower()
        prompts = [
            p
            for p in prompts
            if q_lower in p["name"].lower()
            or q_lower in p["content"].lower()
            or q_lower in p["stage"].lower()
        ]

    total = len(prompts)
    paginated_prompts = prompts[skip : skip + limit]

    res = {"data": paginated_prompts, "total": total}
    await cache.set(cache_key, res, ttl=3600)
    return res


# --- Criteria Management ---


@router.get("/criteria", response_model=PaginatedData[CriterionRead])
async def get_all_criteria(
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("jobs:access")),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: str | None = Query(None),
):
    """Retrieve all available evaluation criteria with pagination and search."""
    # 0. Cache lookup
    cache_key = f"criteria:list:{skip}:{limit}:{q or 'none'}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    stmt = select(Criterion)
    if q:
        stmt = stmt.where(
            Criterion.name.ilike(f"%{q}%") | Criterion.description.ilike(f"%{q}%")
        )

    # Get total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = await db.scalar(count_stmt) or 0

    # Get paginated data
    stmt = stmt.order_by(Criterion.created_at.desc()).offset(skip).limit(limit)
    res = await db.execute(stmt)
    criteria = res.scalars().all()
    
    final_res = {
        "data": [CriterionRead.model_validate(c).model_dump() for c in criteria],
        "total": total
    }
    await cache.set(cache_key, final_res, ttl=3600)
    return final_res


@router.post(
    "/criteria", response_model=CriterionRead, status_code=status.HTTP_201_CREATED
)
async def create_criterion(
    criterion_in: CriterionCreate,
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("jobs:manage")),
):
    """Create a new evaluation criterion."""
    existing = await db.execute(
        select(Criterion).where(func.lower(Criterion.name) == func.lower(criterion_in.name.strip()))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"Criterion with name '{criterion_in.name}' already exists.",
        )



    criterion = Criterion(**criterion_in.model_dump())
    db.add(criterion)
    await db.flush()  # Get the ID without committing

    # 📸 Save version 1 snapshot
    from app.v1.db.models.criterion_versions import CriterionVersion
    version_snapshot = CriterionVersion(
        criterion_id=criterion.id,
        version_number=1,
        name=criterion.name,
        description=criterion.description,
        prompt_text=criterion.prompt_text,
    )
    db.add(version_snapshot)

    await db.commit()
    await db.refresh(criterion)

    # Invalidate cache
    await cache.clear(pattern="criteria:list:*")

    return criterion


@router.patch("/criteria/{criterion_id}", response_model=CriterionRead)
async def update_criterion(
    criterion_id: uuid.UUID,
    criterion_update: CriterionUpdate,
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("jobs:manage")),
):
    """Update an existing evaluation criterion."""
    criterion = await db.get(Criterion, criterion_id)
    if not criterion:
        raise HTTPException(status_code=404, detail="Criterion not found")
    if criterion_update.name and criterion_update.name.strip().lower() != criterion.name.lower():
        existing = await db.execute(
            select(Criterion).where(
                func.lower(Criterion.name) == func.lower(criterion_update.name.strip())
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail=f"Criterion with name '{criterion_update.name}' already exists.",
            )

    # Detect version-worthy changes (name, description, prompt_text)
    version_fields = ["name", "description", "prompt_text"]
    update_data = criterion_update.model_dump(exclude_unset=True)
    version_worthy = any(
        k in update_data and update_data[k] != getattr(criterion, k)
        for k in version_fields
    )

    for field, value in update_data.items():
        setattr(criterion, field, value)

    if version_worthy:
        # 📸 Increment version and save snapshot
        criterion.version = (criterion.version or 1) + 1
        from app.v1.db.models.criterion_versions import CriterionVersion
        version_snapshot = CriterionVersion(
            criterion_id=criterion.id,
            version_number=criterion.version,
            name=criterion.name,
            description=criterion.description,
            prompt_text=criterion.prompt_text,
        )
        db.add(version_snapshot)

    await db.commit()
    await db.refresh(criterion)

    # Invalidate cache
    await cache.clear(pattern="criteria:list:*")

    return criterion


@router.get("/criteria/{criterion_id}", response_model=CriterionRead)
async def get_criterion(
    criterion_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("jobs:access")),
):
    """Get a specific evaluation criterion by ID."""
    criterion = await db.get(Criterion, criterion_id)
    if not criterion:
        raise HTTPException(status_code=404, detail="Criterion not found")
    return criterion


@router.get("/criteria/versions/{version_id}", response_model=CriterionVersionRead)
async def get_criterion_version(
    version_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("jobs:access")),
):
    """Get a specific criterion version snapshot by its unique ID."""
    from app.v1.db.models.criterion_versions import CriterionVersion
    version_snapshot = await db.get(CriterionVersion, version_id)
    if not version_snapshot:
        raise HTTPException(status_code=404, detail="Criterion version snapshot not found")
    return version_snapshot


@router.delete("/criteria/{criterion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_criterion(
    criterion_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: UserRead = Depends(check_permission("jobs:manage")),
):
    """Delete an evaluation criterion.
    
    Validation:
    - Blocks deletion if assigned to a Stage Template.
    - Blocks deletion if assigned to a Job Stage round.
    """
    print(f"\nDEBUG: === DELETE request for criterion: {criterion_id} ===")
    criterion = await db.get(Criterion, criterion_id)
    if not criterion:
        print(f"DEBUG: Criterion {criterion_id} not found in DB")
        raise HTTPException(status_code=404, detail="Criterion not found")

    from app.v1.db.models.stage_template_criteria import StageTemplateCriterion
    from app.v1.db.models.job_stage_configs import JobStageConfig
    from app.v1.db.models.stage_templates import StageTemplate
    from sqlalchemy import exists, or_, cast, String

    id_str = str(criterion_id)
    id_nodash = id_str.replace("-", "")
    c_name = criterion.name

    # 1. Check StageTemplateCriterion Mapping Table
    template_assoc = await db.scalar(
        select(exists().where(StageTemplateCriterion.criterion_id == criterion_id))
    )
    if template_assoc:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete criterion: It is assigned to one or more stage templates via the mapping table."
        )

    # 2. Check Job Stage Configs (Deep search for ID or Name)
    job_assoc = await db.scalar(
        select(exists().where(
            or_(
                JobStageConfig.config["active_criteria"].contains([{"id": id_str}]),
                JobStageConfig.config["criteria_ids"].contains([id_str]),
                JobStageConfig.config["evaluation_criteria"].contains([{"id": id_str}]),
                cast(JobStageConfig.config, String).ilike(f"%{id_str}%"),
                cast(JobStageConfig.config, String).ilike(f"%{id_nodash}%"),
                cast(JobStageConfig.config, String).ilike(f"%{c_name}%")
            )
        ))
    )
    if job_assoc:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete criterion: It is actively being used in one or more job rounds (found ID or name '{c_name}')."
        )

    # 3. Check Stage Templates (Deep search for ID or Name)
    template_config_assoc = await db.scalar(
        select(exists().where(
            or_(
                StageTemplate.default_config["active_criteria"].contains([{"id": id_str}]),
                StageTemplate.default_config["criteria_ids"].contains([id_str]),
                StageTemplate.default_config["evaluation_criteria"].contains([{"id": id_str}]),
                cast(StageTemplate.default_config, String).ilike(f"%{id_str}%"),
                cast(StageTemplate.default_config, String).ilike(f"%{id_nodash}%"),
                cast(StageTemplate.default_config, String).ilike(f"%{c_name}%")
            )
        ))
    )
    if template_config_assoc:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete criterion: It is defined by ID or name ('{c_name}') in the default configuration of a stage template."
        )

    await db.delete(criterion)
    await db.commit()
    
    # Invalidate cache
    await cache.clear(pattern="criteria:list:*")
    
    return None


@router.post(
    "/criteria/enhance", response_model=CriterionEnhanceResponse
)
async def enhance_criterion_prompt(
    request: CriterionEnhanceRequest,
    admin: UserRead = Depends(check_permission("jobs:manage")),
):
    """Enhance a rough criterion prompt text using LLM."""
    try:
        enhanced = await prompt_enhancer_service.enhance_prompt(
            request.name, request.description
        )
        return CriterionEnhanceResponse(enhanced_prompt=enhanced)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to enhance prompt: {str(e)}"
        )

