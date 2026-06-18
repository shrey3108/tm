"""
API routes for job-related operations in version 1.
"""

import uuid
import os
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status, File as FastAPIFile, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.session import get_db
from app.v1.dependencies import check_permission
from app.v1.schemas.job import (
    JobCreate,
    JobRead,
    JobVersionRead,
    JobStatusUpdate,
    JobsListRead,
    JobUpdate,
    JobActivityHistoryResponse,
    JobTitlesListRead,
    JobTaskRead,
)
from app.v1.schemas.job_stage import (
    JobStageConfigCreate,
    JobStageConfigRead,
    JobStageConfigUpdate,
    JobStageReorder,
    JobStageBulkCreate,
)
from app.v1.schemas.criteria import StageCriterionRead
from app.v1.schemas.upload import JobResumesResponse
from app.v1.schemas.user import UserRead
from app.v1.services.admin_service import admin_service
from app.v1.services.job_service import job_service
from app.v1.services.resume_upload_service import resume_upload_service
from app.v1.services.stage_service import stage_service
from app.v1.services.admin.task_service import task_service

router = APIRouter()


@router.get("", response_model=JobsListRead)
async def read_jobs(
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:access")),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: str | None = Query(None, description="General search query for title"),
    status: list[bool] | None = Query(None, description="Filter by active status(es)"),
    department_ids: list[uuid.UUID] | None = Query(None, alias="department_id", description="Filter by one or more department IDs"),
    priority_ids: list[uuid.UUID] | None = Query(None, alias="priority_id", description="Filter by one or more priority IDs"),
    position_ids: list[uuid.UUID] | None = Query(None, alias="position_id", description="Filter by one or more position IDs"),
) -> Any:
    """
    Retrieve a list of jobs with pagination and advanced multi-filters.

    Args:
        db (AsyncSession): Database session.
        skip (int): Number of records to skip.
        limit (int): Maximum number of records to return.
        q (str): General search query for title.
        status (list[bool]): Filter by is_active status(es).
        department_id (list[UUID]): List of department IDs.
        priority_id (list[UUID]): List of priority IDs.
        position_id (list[UUID]): List of position IDs.

    Returns:
        Any: A list of jobs.
    """
    return await job_service.get_jobs(
        db=db, 
        skip=skip, 
        limit=limit, 
        query=q, 
        status=status, 
        department_ids=department_ids,
        priority_ids=priority_ids,
        position_ids=position_ids
    )


@router.get("/search", response_model=JobsListRead)
async def search_jobs(
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:access")),
    q: str = Query(..., min_length=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
) -> Any:
    """
    Search for jobs by title and description.

    Args:
        db (AsyncSession): Database session.
        q (str): The search query.
        skip (int): Number of records to skip.
        limit (int): Maximum number of records to return.

    Returns:
        Any: A list of matching jobs.
    """
    return await job_service.search_jobs(db=db, query=q, skip=skip, limit=limit)


@router.get("/titles", response_model=JobTitlesListRead)
async def get_job_titles(
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:access")),
    q: str | None = Query(None),
) -> Any:
    """
    Retrieve only the IDs and titles of all jobs.
    """
    return await job_service.get_job_titles(db=db, query=q)


@router.get("/titles/grouped", response_model=Any)
async def get_job_titles_grouped(
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:access")),
    q: str | None = Query(None),
) -> Any:
    """
    Retrieve active jobs grouped by title with their position variants.

    Each unique title appears once with a list of available position variants
    (Fresher, Senior, Intern, etc.). The frontend uses this to populate an
    intuitive two-level dropdown: Job Role → Position.
    """
    return await job_service.get_job_titles_grouped(db=db, query=q)


@router.post("", response_model=JobRead, status_code=status.HTTP_201_CREATED)
async def create_job(
    *,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:manage")),
    job_in: JobCreate,
) -> Any:
    """Create a new job."""
    return await admin_service.create_job(db=db, admin_user_id=user.id, job_in=job_in)


from app.v1.services.hr_decision_service import hr_decision_service


@router.get("/{job_id}", response_model=JobRead)
async def get_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:access")),
) -> Any:
    """Get a specific job by ID."""
    job = await admin_service.get_job_by_id(db=db, job_id=job_id)

    # Attach decision stats to avoid extra API call from frontend
    stats = await hr_decision_service.get_job_decision_summary(db=db, job_id=job_id)
    job.decision_summary = stats.model_dump()

    # Attach screening stats
    screening_stats = await hr_decision_service.get_job_screening_summary(
        db=db, job_id=job_id
    )
    job.automated_screening_summary = screening_stats

    return job


@router.get("/versions/{version_id}", response_model=JobVersionRead)
async def get_job_version(
    version_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:access")),
) -> Any:
    """Get a specific job version snapshot by its unique ID."""
    return await admin_service.get_job_version(db=db, version_id=version_id)


@router.get(
    "/{job_id}/resumes",
    response_model=JobResumesResponse,
    status_code=status.HTTP_200_OK,
)
async def get_job_resumes(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: UserRead = Depends(check_permission("jobs:access")),
) -> JobResumesResponse:
    """Retrieve all resumes uploaded for a specific job."""
    return await resume_upload_service.get_resumes_for_job(
        db=db,
        job_id=job_id,
    )


@router.patch("/{job_id}", response_model=JobRead)
async def update_job(
    job_id: uuid.UUID,
    *,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:manage")),
    job_update: JobUpdate,
    background_tasks: BackgroundTasks,
) -> Any:
    """Update a job. Automatically refreshes resumes if custom_extraction_fields changed."""
    return await admin_service.update_job(
        db=db,
        admin_user_id=user.id,
        job_id=job_id,
        job_update=job_update,
        background_tasks=background_tasks,
    )


@router.patch("/{job_id}/status", response_model=JobRead)
async def update_job_status(
    job_id: uuid.UUID,
    *,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:manage")),
    status_in: JobStatusUpdate,
) -> Any:
    """Update job active status without incrementing version."""
    return await admin_service.update_job_status(
        db=db, admin_user_id=user.id, job_id=job_id, status_in=status_in
    )


@router.get("/{job_id}/activity-history", response_model=JobActivityHistoryResponse)
async def get_job_activity_history(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:access")),
) -> Any:
    """
    Get the activity history for a specific job.
    Shows activation sessions and candidate counts per session.
    """
    return await admin_service.get_job_activity_history(db=db, job_id=job_id)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:manage")),
) -> None:
    """Delete a job."""
    await admin_service.delete_job(db=db, admin_user_id=user.id, job_id=job_id)


# --- Job Stage Configuration ---

from app.v1.schemas.job_stage import StageTemplateRead, StageTemplateCreate, StageTemplatesListRead
from app.v1.db.models.stage_templates import StageTemplate

from app.v1.schemas.response import PaginatedData

@router.get("/stage-templates/all", response_model=PaginatedData[StageTemplateRead])
async def get_all_stage_templates(
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:manage")),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: str | None = Query(None),
) -> Any:
    """Retrieve all available stage templates with pagination and search."""
    return await stage_service.get_all_templates(db=db, skip=skip, limit=limit, search=q)

@router.post("/stage-templates", response_model=StageTemplateRead, status_code=status.HTTP_201_CREATED)
async def create_stage_template(
    template_in: StageTemplateCreate,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:manage")),
) -> Any:
    """Create a new custom stage template."""
    new_template = StageTemplate(
        name=template_in.name,
        description=template_in.description,
        default_config=template_in.config or {}
    )
    db.add(new_template)
    await db.commit()
    await db.refresh(new_template)
    return new_template

@router.get("/{job_id}/stages", response_model=list[JobStageConfigRead])
async def get_job_stages(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:access")),
) -> Any:
    """Retrieve the ordered interview stages for a job."""
    return await stage_service.get_job_stages(db=db, job_id=job_id)


@router.post(
    "/{job_id}/stages",
    response_model=JobStageConfigRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_stage_to_job(
    job_id: uuid.UUID,
    *,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:manage")),
    stage_in: JobStageConfigCreate,
) -> Any:
    """Add a new stage to a job's interview process."""
    return await stage_service.add_stage_to_job(db=db, job_id=job_id, stage_in=stage_in)

@router.post(
    "/{job_id}/stages/default",
    response_model=list[JobStageConfigRead],
    status_code=status.HTTP_201_CREATED,
)
async def setup_default_job_stages(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:manage")),
) -> Any:
    """Auto-setup the default 3-round interview pipeline for this job."""
    return await stage_service.setup_default_stages(db=db, job_id=job_id)


@router.patch("/{job_id}/stages/{config_id}", response_model=JobStageConfigRead)
async def update_job_stage(
    job_id: uuid.UUID,
    config_id: uuid.UUID,
    *,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:manage")),
    stage_update: JobStageConfigUpdate,
) -> Any:
    """Update a specific job stage configuration."""
    print(f"DEBUG: update_job_stage called for job {job_id}, config {config_id}")
    print(f"DEBUG: update data: {stage_update.model_dump(exclude_unset=True)}")
    # Verify the config belongs to the job (optional but good practice)
    config = await stage_service.update_job_stage(
        db=db, config_id=config_id, stage_update=stage_update
    )
    return config


@router.delete("/{job_id}/stages/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_stage_from_job(
    job_id: uuid.UUID,
    config_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:manage")),
) -> None:
    """Remove a stage from a job's interview process."""
    await stage_service.remove_stage_from_job(db=db, config_id=config_id)


@router.put("/{job_id}/stages/reorder", response_model=list[JobStageConfigRead])
async def reorder_job_stages(
    job_id: uuid.UUID,
    *,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:manage")),
    reorder_in: JobStageReorder,
) -> Any:
    """Bulk update the order of stages for a job."""
    return await stage_service.reorder_job_stages(
        db=db, job_id=job_id, stage_ids=reorder_in.stage_ids
    )


@router.post("/{job_id}/stages/bulk", response_model=list[JobStageConfigRead])
async def bulk_setup_job_stages(
    job_id: uuid.UUID,
    *,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:manage")),
    bulk_in: JobStageBulkCreate,
) -> Any:
    """
    Setup/Overwrite the entire recruitment pipeline for a job in one go.
    Warning: This replaces all existing stages for the job.
    """
    return await stage_service.bulk_setup_job_stages(
        db=db, job_id=job_id, stages_in=bulk_in.stages
    )


@router.get("/{job_id}/stages/{stage_id}/criteria", response_model=list[StageCriterionRead])
async def get_stage_criteria(
    job_id: uuid.UUID,
    stage_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("jobs:access")),
) -> Any:
    """
    Retrieve the active evaluation criteria for a specific stage of a job.
    Returns criteria linked to the stage's template, including weights.
    """
    from sqlalchemy.orm import selectinload
    from app.v1.db.models.job_stage_configs import JobStageConfig
    from app.v1.db.models.stage_template_criteria import StageTemplateCriterion
    from app.v1.db.models.criteria import Criterion
    from sqlalchemy import select, and_
    from fastapi import HTTPException

    # Verify this stage belongs to the given job
    stage_result = await db.execute(
        select(JobStageConfig).where(
            and_(
                JobStageConfig.id == stage_id,
                JobStageConfig.job_id == job_id,
            )
        )
    )
    stage = stage_result.scalar_one_or_none()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found for this job")

    # Fetch criteria linked to the stage's template
    criteria_result = await db.execute(
        select(Criterion, StageTemplateCriterion.default_weight, StageTemplateCriterion.is_active)
        .join(StageTemplateCriterion, StageTemplateCriterion.criterion_id == Criterion.id)
        .where(
            and_(
                StageTemplateCriterion.template_id == stage.template_id,
                StageTemplateCriterion.is_active == True,
            )
        )
        .order_by(Criterion.name)
    )
    rows = criteria_result.all()

    return [
        StageCriterionRead(
            id=row[0].id,
            name=row[0].name,
            description=row[0].description,
            prompt_text=row[0].prompt_text,
            weight=float(row[1]),
            is_active=row[2],
        )
        for row in rows
    ]


@router.post(
    "/{job_id}/task",
    response_model=JobTaskRead,
    status_code=status.HTTP_200_OK,
)
async def upload_job_task(
    job_id: uuid.UUID,
    task_file: UploadFile = FastAPIFile(...),
    db: AsyncSession = Depends(get_db),
    current_user: UserRead = Depends(check_permission("jobs:manage")),
) -> Any:
    """Upload a candidate task PDF for a specific job and extract required skills."""
    return await task_service.upload_and_extract_task_skills(
        db=db,
        job_id=job_id,
        task_file=task_file,
    )


@router.get(
    "/{job_id}/task",
    response_model=JobTaskRead,
    status_code=status.HTTP_200_OK,
)
async def read_job_task(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserRead = Depends(check_permission("jobs:access")),
) -> Any:
    """Retrieve only the task PDF file path and extracted required skills for a specific job."""
    return await task_service.get_task_skills(
        db=db,
        job_id=job_id,
    )


@router.delete(
    "/{job_id}/task",
    status_code=status.HTTP_200_OK,
)
async def delete_job_task(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserRead = Depends(check_permission("jobs:manage")),
) -> dict[str, str]:
    """Delete the candidate task PDF and reset task skills to null for a specific job."""
    await task_service.delete_task_skills(
        db=db,
        job_id=job_id,
    )
    return {"message": "Task deleted successfully."}


@router.get(
    "/{job_id}/task/file",
    status_code=status.HTTP_200_OK,
)
async def download_job_task_file(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserRead = Depends(check_permission("jobs:access")),
):
    """Download/view the job's default task description file."""
    from fastapi import HTTPException
    from fastapi.responses import FileResponse
    from app.v1.db.models.jobs import Job
    from app.v1.core.storage import resolve_storage_path

    # 1. Fetch Job from DB
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if not job.task_file_path:
        raise HTTPException(status_code=404, detail="No task file uploaded for this Job")

    # 2. Resolve Path
    abs_path = resolve_storage_path(job.task_file_path)
    if not abs_path.is_file():
        raise HTTPException(status_code=404, detail="Task file not found on disk")

    filename = os.path.basename(job.task_file_path)
    # Determine media type based on extension
    media_type = "application/octet-stream"
    if filename.lower().endswith(".pdf"):
        media_type = "application/pdf"
    elif filename.lower().endswith(".docx"):
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif filename.lower().endswith(".doc"):
        media_type = "application/msword"

    return FileResponse(
        path=abs_path,
        filename=filename,
        media_type=media_type
    )





