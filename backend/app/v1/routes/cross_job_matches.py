import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload

from app.v1.db.session import get_db
from app.v1.dependencies import get_current_user
from app.v1.schemas.cross_job_match import CrossJobMatchResponse, CrossJobMatchRead
from app.v1.db.models.cross_job_matches import CrossJobMatch
from app.v1.db.models.resumes import Resume
from app.v1.db.models.jobs import Job
from app.v1.db.models.job_stage_configs import JobStageConfig
from app.v1.services.cross_job_match_service import cross_job_match_service
from app.v1.schemas.user import UserRead

router = APIRouter()

@router.post(
    "/{resume_id}/trigger",
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_cross_job_match(
    resume_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserRead = Depends(get_current_user),
) -> dict:
    """Trigger a cross-job match for a specific resume."""
    # Verify resume exists
    resume = await db.get(Resume, resume_id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )
    
    from app.v1.db.models.candidates import Candidate
    from app.v1.db.models.hr_decisions import HrDecision

    # Verify candidate exists and check latest decision
    candidate = await db.get(Candidate, resume.candidate_id)
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found",
        )

    # Fetch latest decision for the original job (the one they applied for)
    latest_decision_stmt = (
        select(HrDecision)
        .where(HrDecision.candidate_id == candidate.id)
        .where(or_(HrDecision.job_id == candidate.applied_job_id, HrDecision.job_id.is_(None)))
        .order_by(HrDecision.decided_at.desc())
        .limit(1)
    )
    latest_decision_res = await db.execute(latest_decision_stmt)
    latest_decision = latest_decision_res.scalar_one_or_none()

    if not latest_decision or latest_decision.decision.lower() != "fail":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Manual discovery is only allowed once a candidate has been explicitly marked as 'failed' for their applied position."
        )
    
    # Offload to Celery task
    from app.v1.services.resume_upload_service import resume_upload_service
    resume_upload_service.background.schedule_cross_match(
        resume_id=resume_id, 
        original_job_id=candidate.applied_job_id
    )
    
    return {"message": "Cross-job match triggered in background", "resume_id": resume_id}

@router.get(
    "/{resume_id}",
    response_model=CrossJobMatchResponse,
)
async def get_cross_job_matches(
    resume_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserRead = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> CrossJobMatchResponse:
    """Retrieve existing cross-job matches for a resume with pagination."""
    # Verify resume exists and get candidate_id
    resume = await db.get(Resume, resume_id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )
    candidate_id = resume.candidate_id

    # Count total matches for this candidate
    count_query = select(func.count()).where(CrossJobMatch.candidate_id == candidate_id)
    total = await db.scalar(count_query)

    query = (
        select(CrossJobMatch)
        .options(
            selectinload(CrossJobMatch.matched_job).selectinload(Job.skills),
            selectinload(CrossJobMatch.matched_job).selectinload(Job.stages).selectinload(JobStageConfig.template),
            selectinload(CrossJobMatch.matched_job).selectinload(Job.versions),
        )
        .where(CrossJobMatch.candidate_id == candidate_id)
        .order_by(CrossJobMatch.match_score.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(query)
    matches = result.scalars().all()

    data = []
    for m in matches:
        validated = CrossJobMatchRead.model_validate(m)
        score_val = float(m.match_score) if m.match_score is not None else 0.0
        thresh_val = float(m.matched_job.passing_threshold) if m.matched_job and m.matched_job.passing_threshold else 70.0
        validated.pass_fail = "passed" if score_val >= thresh_val else "failed"
        data.append(validated)

    return CrossJobMatchResponse(
        data=data,
        total=total or 0,
    )
