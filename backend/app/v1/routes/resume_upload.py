"""
Resume upload routes module.

This module defines the API endpoints for uploading resumes, checking status,
and retrieving candidate/resume lists for specific jobs.
"""

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, status, Query
from fastapi import File as FastAPIFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.session import get_db
from app.v1.dependencies import check_permission
from app.v1.schemas.upload import (
    JobCandidatesResponse,
    ResumeStatusResponse,
    ResumeUploadResponse,
    BulkResumeUploadResponse,
)
from app.v1.schemas.user import UserRead
from app.v1.services.resume_upload_service import (
    resume_upload_service,
)

router = APIRouter()


@router.post(
    "/jobs/{job_id}/resume",
    response_model=BulkResumeUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_resume_for_job(
    job_id: uuid.UUID,
    resumes: list[UploadFile] = FastAPIFile(...),
    db: AsyncSession = Depends(get_db),
    current_user: UserRead = Depends(check_permission("candidates:access")),
) -> BulkResumeUploadResponse:
    """Upload multiple resumes for a specific job.

    This endpoint accepts multiple resume files, saves them to disk, and initiates
    asynchronous processing to extract information and analyze them.

    Args:
        job_id: The UUID of the job the resumes are for.
        resumes: The uploaded resume files.
        db: The async database session.
        current_user: The authenticated user performing the upload.

    Returns:
        A bulk response indicating which uploads were successful and which failed.
    """
    return await resume_upload_service.upload_resumes_for_job(
        db=db,
        job_id=job_id,
        resumes=resumes,
        current_user=current_user,
    )


@router.get(
    "/jobs/{job_id}/candidates",
    response_model=JobCandidatesResponse,
    status_code=status.HTTP_200_OK,
)
async def get_job_candidates(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: UserRead = Depends(check_permission("candidates:access")),
) -> JobCandidatesResponse:
    """Retrieve all candidates who have applied for a specific job."""
    return await resume_upload_service.get_candidates_for_job(
        db=db,
        job_id=job_id,
    )


@router.get(
    "/jobs/{job_id}/resume/{resume_id}",
    response_model=ResumeStatusResponse,
    status_code=status.HTTP_200_OK,
)
async def get_resume_status(
    job_id: uuid.UUID,
    resume_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserRead = Depends(check_permission("candidates:access")),
) -> ResumeStatusResponse:
    """Retrieve the status and analysis results for a specific resume."""
    return await resume_upload_service.get_resume_status(
        db=db,
        job_id=job_id,
        resume_id=resume_id,
        current_user=current_user,
    )

@router.post(
    "/jobs/{job_id}/refresh-custom-extractions",
    status_code=status.HTTP_202_ACCEPTED,
)
async def refresh_custom_extractions_for_job(
    job_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: UserRead = Depends(check_permission("jobs:manage")),
) -> dict[str, str]:
    """Mass refresh all custom extractions for all existing resumes of a job."""
    await resume_upload_service.trigger_mass_refresh(
        db=db,
        job_id=job_id,
        background_tasks=background_tasks,
    )
    return {"message": f"Mass refresh started for job {job_id}. Resumes will be updated shortly."}


@router.delete(
    "/jobs/{job_id}/resumes/{resume_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_resume(
    job_id: uuid.UUID,
    resume_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserRead = Depends(check_permission("jobs:manage")),
):
    """Delete a specific resume from a job.
    
    This will also remove associated candidate data if no other resumes exist.
    """
    success = await resume_upload_service.delete_resume(
        db=db,
        resume_id=resume_id,
        job_id=job_id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found for this job.",
        )


@router.post(
    "/jobs/{job_id}/candidates/{candidate_id}/reanalyze",
    status_code=status.HTTP_202_ACCEPTED,
)
async def reanalyze_candidate(
    job_id: uuid.UUID,
    candidate_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    version: int | None = Query(None, description="Specific job version to match against. If null, uses global job setting."),
    db: AsyncSession = Depends(get_db),
    current_user: UserRead = Depends(check_permission("jobs:manage")),
) -> dict[str, str]:
    """Manually trigger background re-analysis for a single candidate against the latest JD version."""
    await resume_upload_service.trigger_candidate_reanalyze(
        db=db,
        job_id=job_id,
        candidate_id=candidate_id,
        background_tasks=background_tasks,
        override_version=version,
    )
    return {"message": f"Background re-analysis started for candidate {candidate_id}."}



