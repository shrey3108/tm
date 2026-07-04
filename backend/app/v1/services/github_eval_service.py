import httpx
import uuid
import logging
from typing import Any
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.v1.core.config import settings
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.candidate_test_paper import CandidateTestPaper
from app.v1.db.models.candidate_test_paper_history import CandidateTestPaperHistory
from app.v1.services.evaluation_tasks import evaluate_candidate_practical_task

logger = logging.getLogger(__name__)

async def trigger_github_evaluation(
    db: AsyncSession,
    stage: CandidateStage,
    github_url: str,
    recruiter_email: str | None = None,
) -> dict:
    """
    Core logic to trigger the GitHub evaluation.
    Submits to the evaluator microservice and dispatches the Celery task.
    """
    candidate = stage.candidate
    job = stage.job_stage.job if stage.job_stage else None

    if not candidate or not job:
        raise HTTPException(status_code=400, detail="Candidate or Job association missing.")

    # Fetch all papers in CandidateTestPaperHistory for this candidate and stage
    stmt_history = select(CandidateTestPaperHistory).where(
        CandidateTestPaperHistory.candidate_id == candidate.id
    )
    if stage.job_stage_id:
        stmt_history_stage = stmt_history.where(CandidateTestPaperHistory.job_stage_config_id == stage.job_stage_id)
        res_history = await db.execute(stmt_history_stage)
        history_records = res_history.scalars().all()
        if not history_records:
            stmt_history_none = stmt_history.where(CandidateTestPaperHistory.job_stage_config_id.is_(None))
            res_history = await db.execute(stmt_history_none)
            history_records = res_history.scalars().all()
    else:
        stmt_history = stmt_history.where(CandidateTestPaperHistory.job_stage_config_id.is_(None))
        res_history = await db.execute(stmt_history)
        history_records = res_history.scalars().all()

    has_assigned_paper = False
    task_skills = []
    if history_records:
        has_assigned_paper = True
        for hr in history_records:
            if hr.task_skills:
                task_skills.extend(hr.task_skills)
        task_skills = list(set(task_skills))
    else:
        # Fallback to active CandidateTestPaper
        stmt_paper = select(CandidateTestPaper).where(
            CandidateTestPaper.candidate_id == candidate.id
        )
        if stage.job_stage_id:
            stmt_paper_stage = stmt_paper.where(CandidateTestPaper.job_stage_config_id == stage.job_stage_id)
            res_paper = await db.execute(stmt_paper_stage)
            test_paper = res_paper.scalar_one_or_none()
            if not test_paper:
                stmt_paper_none = stmt_paper.where(CandidateTestPaper.job_stage_config_id.is_(None))
                res_paper = await db.execute(stmt_paper_none)
                test_paper = res_paper.scalar_one_or_none()
        else:
            stmt_paper = stmt_paper.where(CandidateTestPaper.job_stage_config_id.is_(None))
            res_paper = await db.execute(stmt_paper)
            test_paper = res_paper.scalar_one_or_none()

        # Fallback to job-level default test paper
        target_job_id = stage.job_stage.job_id if stage.job_stage else candidate.applied_job_id
        if not test_paper and target_job_id:
            stmt_job = select(CandidateTestPaper).where(
                CandidateTestPaper.job_id == target_job_id,
                CandidateTestPaper.candidate_id.is_(None)
            )
            if stage.job_stage_id:
                stmt_job_stage = stmt_job.where(CandidateTestPaper.job_stage_config_id == stage.job_stage_id)
                res_job = await db.execute(stmt_job_stage)
                test_paper = res_job.scalar_one_or_none()
                if not test_paper:
                    stmt_job_none = stmt_job.where(CandidateTestPaper.job_stage_config_id.is_(None))
                    res_job = await db.execute(stmt_job_none)
                    test_paper = res_job.scalar_one_or_none()
            else:
                stmt_job = stmt_job.where(CandidateTestPaper.job_stage_config_id.is_(None))
                res_job = await db.execute(stmt_job)
                test_paper = res_job.scalar_one_or_none()

        if test_paper:
            has_assigned_paper = True
            if test_paper.task_skills:
                task_skills = test_paper.task_skills

    if not has_assigned_paper:
        raise HTTPException(
            status_code=400,
            detail="Please assign a test paper to the candidate first before running the repository evaluation.",
        )

    # Get Job standard skills
    jd_skills = [skill.name for skill in job.skills] if job.skills else []

    # Trigger microservice evaluation submit synchronously
    evaluator_url = settings.GITHUB_EVALUATOR_URL
    submit_url = f"{evaluator_url.rstrip('/')}/api/v1/repositories"
    
    recruiter_email = recruiter_email or settings.DEFAULT_RECRUITER_EMAIL
    candidate_email = settings.DEFAULT_CANDIDATE_EMAIL or (candidate.email if candidate else None)

    payload = {
        "github_url": github_url,
        "job_title": job.title if job else "Software Engineer",
        "job_position": job.position.name if (job and job.position) else None,
        "jd_skills": jd_skills,
        "project_required_skills": task_skills,
        "repo_id": str(candidate.id) if candidate else None,
        "candidate_email": candidate_email,
        "recruiter_email": recruiter_email,
    }

    eval_id = None
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(submit_url, json=payload)
            
            if response.status_code not in (200, 201):
                error_msg = "Failed to submit repository to evaluator."
                try:
                    error_data = response.json()
                    error_msg = error_data.get("error_message") or error_data.get("detail") or error_data.get("message") or error_data.get("error") or response.text
                    eval_id = error_data.get("evaluation_id")
                except Exception:
                    error_msg = response.text or error_msg
                    eval_id = None
                
                if response.status_code == 409:
                    if eval_id:
                        logger.info(f"Repository already submitted. Re-using evaluation ID: {eval_id}")
                    else:
                        raise HTTPException(status_code=409, detail=error_msg)
                else:
                    stage.status = "failed"
                    stage.evaluation_data = {
                        "error": error_msg,
                        "status": "submission_error",
                        "github_url": github_url
                    }
                    await db.commit()
                    raise HTTPException(status_code=response.status_code, detail=error_msg)

            submit_data = response.json()
            eval_id = submit_data.get("evaluation_id")
            submit_status = submit_data.get("status")

            if not eval_id or submit_status in ("cloning_error", "failed"):
                error_msg = submit_data.get("error_message") or submit_data.get("message") or submit_data.get("detail") or "Failed to initiate evaluation on evaluator service."
                stage.status = "failed"
                stage.evaluation_data = {
                    "error": error_msg,
                    "status": submit_status or "submission_error",
                    "github_url": github_url
                }
                await db.commit()
                raise HTTPException(status_code=400, detail=error_msg)

    except httpx.HTTPError as he:
        error_msg = f"Communication with evaluator microservice failed: {str(he)}"
        stage.status = "failed"
        stage.evaluation_data = {
            "error": error_msg,
            "status": "communication_error",
            "github_url": github_url
        }
        await db.commit()
        raise HTTPException(status_code=502, detail=error_msg)

    stage.status = "processing"
    
    # Preserve other data like submitted_at
    eval_data = stage.evaluation_data if isinstance(stage.evaluation_data, dict) else {}
    eval_data["github_url"] = github_url
    stage.evaluation_data = eval_data
    
    await db.commit()

    evaluate_candidate_practical_task.delay(
        str(stage.id),
        github_url,
        jd_skills,
        task_skills,
        recruiter_email=recruiter_email,
        eval_id=eval_id,
    )

    return {
        "message": "GitHub repository evaluation task has been triggered successfully in the background.",
        "candidate_stage_id": stage.id,
        "github_url": github_url,
        "status": "processing",
        "evaluation_id": eval_id,
    }
