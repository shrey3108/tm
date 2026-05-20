"""
API routes for candidate-related operations in version 1.
"""

import uuid
from datetime import datetime
from typing import Any

from app.v1.db.session import get_db
from app.v1.dependencies import check_permission
from app.v1.schemas.response import PaginatedData
from app.v1.schemas.upload import CandidateResponse
from app.v1.schemas.timeline import HiringTimelineResponse
from app.v1.schemas.user import UserRead
from app.v1.schemas.hr_decision import (
    HRDecisionCreate,
    HRDecisionResponse,
    HRDecisionHistoryResponse,
    HRDecisionUpdate,
    HRDecisionSummary,
    HRJobDecisionSummary,
)
from app.v1.services.admin_service import admin_service
from app.v1.services.hr_decision_service import hr_decision_service
from app.v1.services.job_stats_service import job_stats_service
from app.v1.services.admin.candidate_service import candidate_admin_service
from app.v1.schemas.job_stats import JobStatsResponse
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.get(
    "/jobs/{job_id}/stats",
    response_model=JobStatsResponse,
    tags=["Job Stats"],
    summary="Get comprehensive stats for a specific job",
)
async def get_job_stats(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
) -> JobStatsResponse:
    """
    Returns a full stats breakdown for a job:
      - result: AI screening pass / fail / pending counts (native + cross-matched)
      - location: candidate count grouped by city/location
      - stages: candidate count grouped by hiring pipeline stage name
      - hr_decisions: HR decision summary (total, passed, failed, maybe, pending)
    """
    try:
        return await job_stats_service.get_job_stats(
            db=db, 
            job_id=job_id,
            start_date=start_date,
            end_date=end_date
        )
    except Exception as e:
        print(f"Error in get_job_stats: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/search", response_model=PaginatedData[CandidateResponse])
async def search_candidates(
    query: str | None = Query(None, description="General search query (name, email)"),
    job: str | None = Query(None, description="Job name or UUID"),
    hr_decision: list[str] | None = Query(None, description="Latest HR decision (passed, failed, maybe)"),
    hr_score: list[int] | None = Query(None, description="Filter by HR score rating(s): 1 to 5"),
    city: list[str] | None = Query(None, description="City/Location name(s)"),
    result: list[str] | None = Query(None, description="AI screening result: 'passed', 'failed', or 'pending'"),
    stage_id: list[str] | None = Query(None, description="Hiring pipeline stage name(s) or ID(s)"),
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
) -> Any:
    """Search candidates across all jobs with advanced filters."""
    return await admin_service.search_candidates(
        db=db, 
        query=query, 
        job=job,
        hr_decision=hr_decision,
        hr_score=hr_score,
        city=city,
        result=result,
        stage_id=stage_id,
        start_date=start_date,
        end_date=end_date,
        skip=skip, 
        limit=limit
    )


@router.get("/jobs/{job_id}", response_model=PaginatedData[CandidateResponse])
async def get_job_candidates(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    query: str | None = Query(None, description="Search candidates by first name, last name, or email"),
    hr_decision: list[str] | None = Query(None, description="Filter by HR decision: 'pass', 'fail', or 'May Be'"),
    hr_score: list[int] | None = Query(None, description="Filter by HR score rating(s): 1 to 5"),
    jd_version: list[int] | None = Query(None, description="Filter by original JD version number(s)"),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    candidate_id: uuid.UUID | None = Query(None, description="Filter by specific candidate ID"),
    stage_id: list[str] | None = Query(None, description="Filter by specific stage ID(s) or name(s)"),
    city: list[str] | None = Query(None, description="Filter by candidate city/location(s)"),
    result: list[str] | None = Query(None, description="AI result filter: 'passed', 'failed', 'pending'"),
) -> Any:
    """Get all candidates for a specific job, with optional searching and filtering."""
    return await admin_service.get_candidates_for_job(
        db=db,
        job_id=job_id,
        skip=skip,
        limit=limit,
        query=query,
        hr_decision=hr_decision,
        hr_score=hr_score,
        jd_version=jd_version,
        start_date=start_date,
        end_date=end_date,
        candidate_id=candidate_id,
        stage_id=stage_id,
        city=city,
        result=result,
    )




@router.get(
    "/{candidate_id}/evaluations",
    include_in_schema=False,
)
async def get_candidate_evaluations(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
) -> Any:
    """Retired: Get all interview stage evaluations for a specific candidate."""
    from fastapi import HTTPException

    raise HTTPException(
        status_code=410, detail="Evaluation features are disabled."
    )


@router.get(
    "/{candidate_id}/evaluations/{stage_config_id}",
    include_in_schema=False,
)
async def get_candidate_stage_evaluation(
    candidate_id: uuid.UUID,
    stage_config_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
) -> Any:
    """Retired: Get a specific interview stage evaluation for a candidate."""
    from fastapi import HTTPException

    raise HTTPException(
        status_code=410, detail="Evaluation features are disabled."
    )


# HR Decision Management Endpoints


@router.get("/decisions/summary", response_model=HRDecisionSummary, tags=["HR Decisions"])
async def get_global_decision_summary(
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
) -> Any:
    """Get global HR decision summary — total proceed, fail, May Be, and undecided counts across ALL candidates."""
    try:
        return await hr_decision_service.get_decision_summary(db=db)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")




@router.post("/{candidate_id}/decisions", response_model=HRDecisionResponse)
async def create_candidate_decision(
    candidate_id: uuid.UUID,
    decision_data: HRDecisionCreate,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:decide")),
) -> Any:
    """Create a new HR decision for a candidate."""
    try:
        return await hr_decision_service.create_decision(
            db=db,
            candidate_id=candidate_id,
            decision_data=decision_data,
            user_id=user.id,
            stage_config_id=decision_data.stage_config_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{candidate_id}/decisions", response_model=HRDecisionHistoryResponse)
async def get_candidate_decision_history(
    candidate_id: uuid.UUID,
    job_id: uuid.UUID | None = None,
    stage_config_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
) -> Any:
    """Get complete decision history for a candidate."""
    try:
        return await hr_decision_service.get_decision_history(
            db=db,
            candidate_id=candidate_id,
            job_id=job_id,
            stage_config_id=stage_config_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/decisions/{decision_id}", response_model=HRDecisionResponse)
async def update_candidate_decision(
    decision_id: uuid.UUID,
    decision_data: HRDecisionUpdate,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:decide")),
) -> Any:
    """Update an existing HR decision."""
    try:
        return await hr_decision_service.update_decision(
            db=db,
            decision_id=decision_id,
            decision_data=decision_data,
            user_id=user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")



@router.delete("/{identifier}/test", tags=["Testing"])
async def delete_candidate_test(
    identifier: str,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:decide")),
) -> Any:
    """
    [FOR TESTING ONLY] Delete a candidate and all related records by ID or email.
    """
    success = await admin_service.delete_candidate(db=db, admin_user_id=user.id, identifier=identifier)
    if not success:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return {"message": "Candidate and all related records deleted successfully"}


@router.get("/{candidate_id}/timeline", response_model=HiringTimelineResponse)
async def get_candidate_timeline(
    candidate_id: uuid.UUID,
    job_id: uuid.UUID | None = Query(None),
    q: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
) -> Any:
    """
    Retrieve the chronological hiring timeline for a candidate.
    Supports optional job_id and 'q' (search query) filters.
    """
    return await candidate_admin_service.get_candidate_timeline(
        db=db, 
        candidate_id=candidate_id, 
        job_id=job_id,
        query=q
    )
