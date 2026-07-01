import logging
import urllib.request
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from github_code_evaluator.app.v1.core.security import get_current_user
from github_code_evaluator.app.v1.db.models.evaluation import Evaluation
from github_code_evaluator.app.v1.db.models.repository import Repository
from github_code_evaluator.app.v1.db.models.role_config import RoleWeightConfig
from github_code_evaluator.app.v1.db.session import get_db
from github_code_evaluator.app.v1.schemas.evaluation import (
    EvaluationStatusResponse,
    RepositorySubmitRequest,
    RepositorySubmitResponse,
)
from github_code_evaluator.app.v1.services.repo import RepositoryService
from github_code_evaluator.app.v1.services.email import email_service
from github_code_evaluator.app.v1.core.config import settings
from github_code_evaluator.workers.tasks import send_access_failure_email_task, run_evaluation_task

logger = logging.getLogger(__name__)
router = APIRouter()


def check_url_accessibility(url: str) -> bool:
    """Helper to verify if a remote Git URL is accessible (returns HTTP 200)."""
    url = url.strip()
    for method in ["HEAD", "GET"]:
        try:
            check_url = url
            if check_url.endswith(".git"):
                check_url = check_url[:-4]
                
            req = urllib.request.Request(
                check_url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
                method=method,
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status in [200, 301, 302]:
                    return True
        except Exception as e:
            logger.warning(f"URL accessibility check failed for {url} with {method}: {e}")
    return False


@router.post("", response_model=RepositorySubmitResponse, status_code=status.HTTP_201_CREATED)
async def submit_repository(
    payload: RepositorySubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Submit a candidate repository URL to trigger automated code evaluation."""
    # 1. Validate URL format
    if not RepositoryService.validate_url(payload.github_url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid GitHub repository URL format",
        )

    # 1.1 Rate-limit check on queue depth
    stmt_active = select(Evaluation).where(Evaluation.status.in_(["queued", "processing"]))
    result_active = await db.execute(stmt_active)
    active_evals = result_active.scalars().all()
    if len(active_evals) >= settings.MAX_QUEUE_DEPTH:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many active evaluation tasks. Please try again later.",
        )

    # 2. Check accessibility (simulate public vs private)
    is_accessible = check_url_accessibility(payload.github_url)

    try:
        # Normalize skills payloads to handle None vs empty lists consistently
        jd_skills_normalized = payload.jd_skills if payload.jd_skills is not None else []
        project_skills_normalized = payload.project_required_skills if payload.project_required_skills is not None else []

        # Resolve default skills if empty
        if not jd_skills_normalized:
            # Check database configs case-insensitively
            from sqlalchemy import func
            stmt_role = select(RoleWeightConfig).where(
                func.lower(RoleWeightConfig.role_name) == func.lower(payload.job_title.strip())
            )
            result_role = await db.execute(stmt_role)
            role_cfg = result_role.scalar_one_or_none()
            if role_cfg and role_cfg.default_skills:
                jd_skills_normalized = role_cfg.default_skills

        # Check if we already have an evaluation for this github_url
        stmt = (
            select(Evaluation)
            .join(Repository)
            .where(Repository.github_url == payload.github_url)
            .order_by(Evaluation.created_at.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        existing_eval = result.scalar_one_or_none()
        if existing_eval and existing_eval.status not in ["cloning_error", "expired", "failed"]:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content={
                    "detail": "Repository has already been submitted for evaluation.",
                    "evaluation_id": str(existing_eval.evaluation_id),
                    "status": existing_eval.status
                }
            )

        # Check if the repository record with identical URL already exists to avoid duplicates
        stmt_repo = (
            select(Repository)
            .where(Repository.github_url == payload.github_url)
            .limit(1)
        )
        result_repo = await db.execute(stmt_repo)
        repo = result_repo.scalar_one_or_none()

        if not repo:
            # 3. Store new Repository entry
            repo = Repository(
                github_url=payload.github_url,
                jd_skills=jd_skills_normalized,
                project_required_skills=project_skills_normalized,
            )
            db.add(repo)
            await db.flush()  # populate repo.repository_id

        # 4. Store Evaluation entry (queued or cloning_error depending on accessibility)
        evaluation = Evaluation(
            repository_id=repo.repository_id,
            status="queued" if is_accessible else "cloning_error",
            job_title=payload.job_title,
            job_position=payload.job_position,
            job_description="",
            candidate_email=payload.candidate_email,
            recruiter_email=payload.recruiter_email or settings.HR_EMAIL,
        )
        db.add(evaluation)
        await db.commit()
        await db.refresh(evaluation)

        if not is_accessible:
            # Send accessibility failure email task
            try:
                candidate_email = payload.candidate_email or "candidate@example.com"
                recruiter_email = payload.recruiter_email or settings.HR_EMAIL
                grace_hours = getattr(settings, "REPO_ACCESS_GRACE_PERIOD_HOURS", 48)
                send_access_failure_email_task.delay(
                    candidate_email,
                    recruiter_email,
                    payload.github_url,
                    grace_hours
                )
            except Exception as e:
                logger.error(f"Failed to send accessibility failure email: {e}")

            return RepositorySubmitResponse(
                repository_id=repo.repository_id,
                evaluation_id=evaluation.evaluation_id,
                status=evaluation.status,
                message="Evaluation stopped: The GitHub repository is private or inaccessible.",
            )

        # 5. Dispatch async Celery evaluation task (only if accessible)
        run_evaluation_task.delay(
            evaluation_id=str(evaluation.evaluation_id),
            role=payload.job_title,
            job_position=payload.job_position,
            job_description="",
        )

        return RepositorySubmitResponse(
            repository_id=repo.repository_id,
            evaluation_id=evaluation.evaluation_id,
            status=evaluation.status,
            message="Repository submission successful.",
        )
    except HTTPException:
        # Re-raise HTTPExceptions directly so FastAPI returns the correct response
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error submitting repository: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit repository: {str(e)}",
        )


@router.get("/{evaluation_id}/status", response_model=EvaluationStatusResponse)
async def get_evaluation_status(
    evaluation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Retrieve the current processing status and details of a queued evaluation."""
    result = await db.execute(select(Evaluation).where(Evaluation.evaluation_id == evaluation_id))
    evaluation = result.scalar_one_or_none()

    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation job not found",
        )

    error_msg = None
    if evaluation.status == "cloning_error":
        error_msg = "Evaluation stopped: The GitHub repository is private or inaccessible."

    return EvaluationStatusResponse(
        evaluation_id=evaluation.evaluation_id,
        status=evaluation.status,
        overall_score=float(evaluation.overall_score) if evaluation.overall_score is not None else None,
        recommendation=evaluation.recommendation,
        error_message=error_msg,
        created_at=evaluation.created_at,
    )


@router.delete("/{repository_id}", status_code=status.HTTP_200_OK)
async def delete_repository_by_id(
    repository_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Delete a repository and all of its associated evaluations, scores, reports, and security findings by repository ID."""
    stmt = select(Repository).where(Repository.repository_id == repository_id)
    result = await db.execute(stmt)
    repository = result.scalar_one_or_none()

    if not repository:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found",
        )

    await db.delete(repository)
    await db.commit()

    return {"message": "Repository and all associated data deleted successfully."}


@router.delete("", status_code=status.HTTP_200_OK)
async def delete_repository_by_url(
    github_url: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Delete a repository and all of its associated evaluations, scores, reports, and security findings by its GitHub URL."""
    stmt = select(Repository).where(Repository.github_url == github_url.strip())
    result = await db.execute(stmt)
    repository = result.scalar_one_or_none()

    if not repository:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found for the given URL",
        )

    await db.delete(repository)
    await db.commit()

    return {"message": "Repository and all associated data deleted successfully."}
