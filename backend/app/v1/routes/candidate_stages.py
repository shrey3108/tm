import uuid
from datetime import datetime, timezone
from typing import Any, List

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.v1.core.config import settings
from app.v1.core.logging import get_logger
from app.v1.db.session import get_db
from app.v1.db.models.evaluations import Evaluation
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.hr_decisions import HrDecision
from app.v1.db.models.job_stage_configs import JobStageConfig
from app.v1.db.models.jobs import Job
from app.v1.db.models.stage_templates import StageTemplate
from app.v1.db.models.candidate_test_paper import CandidateTestPaper
from app.v1.db.models.candidate_test_paper_history import CandidateTestPaperHistory
from app.v1.schemas.candidate_stages import StageOverrideCreate, StageDecisionCreate, EvaluationRead
from app.v1.schemas.user import UserRead
from app.v1.dependencies import check_permission
from app.v1.services.admin_service import admin_service
from app.v1.services.hr_decision_service import HRDecisionService
from app.v1.schemas.hr_decision import HRDecisionCreate
from app.v1.services.evaluation_tasks import evaluate_candidate_practical_task

router = APIRouter(prefix="/candidate-stages", tags=["candidate-stages"])

@router.get("/{id}/evaluation")
async def get_candidate_stage_evaluation(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:read")),
) -> EvaluationRead:
    """Retrieve the full evaluation result for a specific candidate stage."""
    res = await db.execute(
        select(Evaluation)
        .where(Evaluation.candidate_stage_id == id)
        .order_by(Evaluation.attempt_number.desc())
    )
    evaluation = res.scalars().first()
    if not evaluation:
        # Check if the CandidateStage exists and has a cloning/processing error
        stage = await db.get(CandidateStage, id)
        if stage and stage.status == "failed" and isinstance(stage.evaluation_data, dict) and "error" in stage.evaluation_data:
            # Construct a mock Evaluation dict with the error details conforming to EvaluationRead
            return {
                "id": id,  # Use stage id as a dummy evaluation id
                "candidate_stage_id": id,
                "version": 1,
                "overall_score": 0.0,
                "result": "fail",
                "structured_evaluation_data": {},  # maps to evaluation_data schema field
                "created_at": stage.completed_at or stage.started_at or datetime.now(timezone.utc),
                "highlights": {
                    "overall_summary": f"Evaluation Failed: {stage.evaluation_data.get('error')}",
                    "recommendation": f"Failed with status: {stage.evaluation_data.get('status', 'unknown')}",
                    "strengths": [],
                    "weaknesses": [],
                    "suggested_followups": []
                }
            }
        if stage and stage.status in ["pending", "processing", "in_progress", "scheduled"]:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=202, 
                content={"status": "processing", "detail": "Evaluation is currently processing"}
            )
            
        raise HTTPException(status_code=404, detail="Evaluation not found for this candidate stage")
    return evaluation


@router.get("/{id}/evaluation/history")
async def get_candidate_stage_evaluation_history(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:read")),
) -> List[EvaluationRead]:
    """Retrieve all evaluation attempts for a specific candidate stage."""
    res = await db.execute(
        select(Evaluation)
        .where(Evaluation.candidate_stage_id == id)
        .order_by(Evaluation.attempt_number.desc())
    )
    evaluations = res.scalars().all()
    evaluations_list = list(evaluations)

    # Check if the CandidateStage is failed with an error and include it in history
    stage = await db.get(CandidateStage, id)
    if stage and stage.status == "failed" and isinstance(stage.evaluation_data, dict) and "error" in stage.evaluation_data:
        # If there are existing evaluations, the next attempt version is max + 1, otherwise 1
        next_version = (evaluations_list[0].attempt_number + 1) if evaluations_list else 1
        
        mock_eval = {
            "id": id,  # Use stage id as a dummy evaluation id
            "candidate_stage_id": id,
            "version": next_version,
            "overall_score": 0.0,
            "result": "fail",
            "structured_evaluation_data": {},
            "created_at": stage.completed_at or stage.started_at or datetime.now(timezone.utc),
            "highlights": {
                "overall_summary": f"Evaluation Failed: {stage.evaluation_data.get('error')}",
                "recommendation": f"Failed with status: {stage.evaluation_data.get('status', 'unknown')}",
                "strengths": [],
                "weaknesses": [],
                "suggested_followups": []
            }
        }
        # Prepend so the latest failed attempt appears first in history
        evaluations_list.insert(0, mock_eval)

    if not evaluations_list:
        raise HTTPException(status_code=404, detail="No evaluations found for this candidate stage")
        
    return evaluations_list


@router.get("/{id}/similarity-scores")
async def get_candidate_stage_similarity_scores(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:read")),
) -> Any:
    """Get similarity metrics (JD vs Resume, JD vs Transcript, Resume vs Transcript)."""
    res = await db.execute(
        select(Evaluation)
        .where(Evaluation.candidate_stage_id == id)
        .order_by(Evaluation.attempt_number.desc())
    )
    evaluation = res.scalars().first()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
        
    return {
        "candidate_stage_id": evaluation.candidate_stage_id,
        "similarity_scores": {
            "jd_vs_resume": evaluation.sim_jd_resume,
            "jd_vs_transcript": evaluation.sim_jd_transcript,
            "resume_vs_transcript": evaluation.sim_resume_transcript
        }
    }


@router.post("/{id}/override")
async def override_candidate_stage(
    id: uuid.UUID,
    override_in: StageOverrideCreate,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:decide")),
) -> Any:
    """Override AI evaluation recommendation and/or criterion scores."""
    
    # 1. Fetch CandidateStage and Evaluation
    stage = await db.get(CandidateStage, id)
    if not stage:
        raise HTTPException(status_code=404, detail="Candidate stage not found")
        
    res = await db.execute(select(Evaluation).where(Evaluation.candidate_stage_id == id))
    evaluation = res.scalars().first()
    
    if not evaluation:
        raise HTTPException(status_code=400, detail="No evaluation found to override")
        
    # 2. Update Evaluation JSON with overrides
    eval_data = dict(evaluation.evaluation_data)
    if "overrides" not in eval_data:
        eval_data["overrides"] = []
        
    eval_data["overrides"].append({
        "user_id": str(user.id),
        "reason": override_in.override_reason,
        "recommendation": override_in.override_recommendation,
        "criterion_scores": override_in.criterion_scores
    })
    
    # If overriding specific criteria, we could recalculate overall_score here.
    # For now, we mainly override the textual recommendation in the UI logic or evaluation data.
    if override_in.override_recommendation:
        evaluation.recommendation = override_in.override_recommendation
        
    evaluation.evaluation_data = eval_data
    
    # 3. Update stage status if needed
    if stage.status == "processing":
         stage.status = "completed"
         
    await db.commit()
    
    # 4. Audit Log
    await admin_service.log_action(
        db=db,
        user_id=user.id,
        action="override_evaluation",
        target_type="evaluation",
        target_id=evaluation.id,
        details={"reason": override_in.override_reason, "stage_id": str(id)}
    )
    
    return {"message": "Override applied successfully", "evaluation_id": evaluation.id}


@router.post("/{id}/decision")
async def candidate_stage_decision(
    id: uuid.UUID,
    decision_in: StageDecisionCreate,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:decide")),
) -> Any:
    """Final HR decision for this candidate stage (Pass, Fail, May Be)."""
    
    # 1. Fetch CandidateStage to get candidate and job info
    query = (
        select(CandidateStage)
        .options(selectinload(CandidateStage.job_stage))
        .where(CandidateStage.id == id)
    )
    res = await db.execute(query)
    stage = res.scalars().first()
    
    if not stage:
        raise HTTPException(status_code=404, detail="Candidate stage not found")
        
    # 2. Use HRDecisionService to handle the decision
    # This automatically handles validation, stage advancement, and auto-failures
    hr_service = HRDecisionService()
    
    decision_data = HRDecisionCreate(
        decision=decision_in.decision,
        notes=decision_in.notes,
        job_id=stage.job_stage.job_id if stage.job_stage else None,
        stage_config_id=stage.job_stage_id
    )
    try:
        hr_decision = await hr_service.create_decision(
            db=db,
            candidate_id=stage.candidate_id,
            decision_data=decision_data,
            user_id=user.id,
            stage_config_id=stage.job_stage_id
        )
        
        return {
            "message": f"Decision '{decision_in.decision}' recorded successfully.",
            "decision": hr_decision,
            "next_step": "Candidate status and pipeline have been updated."
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record decision: {str(e)}")


class GitHubEvaluationRequest(BaseModel):
    github_url: str | None = None

@router.post("/{id}/evaluate-github")
async def evaluate_candidate_github_repo(
    id: uuid.UUID,
    payload: GitHubEvaluationRequest,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:decide")),
) -> Any:
    """Trigger background GitHub repository evaluation for the Technical Practical Round."""

    # 1. Fetch CandidateStage with eager relationships
    stmt = (
        select(CandidateStage)
        .options(
            selectinload(CandidateStage.job_stage).options(
                selectinload(JobStageConfig.job).selectinload(Job.skills),
                selectinload(JobStageConfig.template),
            ),
            selectinload(CandidateStage.candidate).selectinload(Candidate.resumes),
        )
        .where(CandidateStage.id == id)
    )
    res = await db.execute(stmt)
    stage = res.scalars().first()

    if not stage:
        raise HTTPException(status_code=404, detail="Candidate stage not found")

    # 2. Verify stage is Technical Practical Round
    stage_template_name = stage.job_stage.template.name if stage.job_stage and stage.job_stage.template else None
    if stage_template_name != "Technical Practical Round":
        raise HTTPException(
            status_code=400,
            detail=f"This stage is not configured for Technical Practical Round evaluation (found: {stage_template_name}).",
        )

    candidate = stage.candidate
    job = stage.job_stage.job

    if not candidate or not job:
        raise HTTPException(status_code=400, detail="Candidate or Job association missing.")

    # 3. Resolve GitHub URL (payload URL takes precedence over candidate.task_file_path)
    github_url = payload.github_url
    if not github_url:
        task_path = candidate.task_file_path or ""
        if task_path.startswith(("http://", "https://")) and "github.com" in task_path.lower():
            github_url = task_path

    if not github_url:
        raise HTTPException(
            status_code=400,
            detail="GitHub URL not found. Please provide a valid GitHub repository URL in the request body.",
        )

    # 4. Save/update candidate task_file_path with the solution repo URL
    candidate.task_file_path = github_url

    # 5. Fetch all papers in CandidateTestPaperHistory for this candidate
    stmt_history = select(CandidateTestPaperHistory).where(CandidateTestPaperHistory.candidate_id == candidate.id)
    res_history = await db.execute(stmt_history)
    history_records = res_history.scalars().all()

    task_skills = []
    if history_records:
        # Combine and deduplicate skills from all history records
        for hr in history_records:
            if hr.task_skills:
                task_skills.extend(hr.task_skills)
        task_skills = list(set(task_skills))
    else:
        # Fallback to active CandidateTestPaper (if assigned but not emailed yet)
        stmt_paper = select(CandidateTestPaper).where(CandidateTestPaper.candidate_id == candidate.id)
        res_paper = await db.execute(stmt_paper)
        test_paper = res_paper.scalar_one_or_none()

        # Fallback to job-level default test paper
        if not test_paper and candidate.applied_job_id:
            stmt_job = select(CandidateTestPaper).where(
                CandidateTestPaper.job_id == candidate.applied_job_id,
                CandidateTestPaper.candidate_id.is_(None)
            )
            res_job = await db.execute(stmt_job)
            test_paper = res_job.scalar_one_or_none()

        if test_paper and test_paper.task_skills:
            task_skills = test_paper.task_skills

    if not task_skills:
        raise HTTPException(
            status_code=400,
            detail="Please assign a test paper to the candidate first before running the repository evaluation.",
        )

    # 6. Get Job standard skills
    jd_skills = [skill.name for skill in job.skills] if job.skills else []

    # 7. Trigger microservice evaluation submit synchronously to detect duplicate/cloning errors immediately
    evaluator_url = settings.GITHUB_EVALUATOR_URL
    submit_url = f"{evaluator_url.rstrip('/')}/api/v1/repositories"
    # Prioritize settings.DEFAULT_RECRUITER_EMAIL from .env over user.email
    recruiter_email = settings.DEFAULT_RECRUITER_EMAIL or (user.email if user else None)

    # Prioritize settings.DEFAULT_CANDIDATE_EMAIL from .env over candidate.email
    candidate_email = settings.DEFAULT_CANDIDATE_EMAIL or (candidate.email if (candidate and candidate.email) else None)

    payload = {
        "github_url": github_url,
        "job_title": job.title if job else "Software Engineer",
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
                        get_logger(__name__).info(f"Repository already submitted. Re-using evaluation ID: {eval_id}")
                    else:
                        raise HTTPException(status_code=409, detail=error_msg)
                else:
                    stage.evaluation_data = {
                        "error": error_msg,
                        "status": "submission_error"
                    }
                    await db.commit()
                    raise HTTPException(status_code=response.status_code, detail=error_msg)

            submit_data = response.json()
            eval_id = submit_data.get("evaluation_id")
            submit_status = submit_data.get("status")

            # Check if there is an immediate cloning_error or other failure in submission response
            if not eval_id or submit_status in ("cloning_error", "failed"):
                error_msg = submit_data.get("error_message") or submit_data.get("message") or submit_data.get("detail") or "Failed to initiate evaluation on evaluator service."
                stage.evaluation_data = {
                    "error": error_msg,
                    "status": submit_status or "submission_error"
                }
                await db.commit()
                raise HTTPException(status_code=400, detail=error_msg)

    except httpx.HTTPError as he:
        error_msg = f"Communication with evaluator microservice failed: {str(he)}"
        stage.evaluation_data = {
            "error": error_msg,
            "status": "communication_error"
        }
        await db.commit()
        raise HTTPException(status_code=502, detail=error_msg)

    # 8. Set stage status to processing since submission succeeded
    stage.status = "processing"
    stage.evaluation_data = {}  # Reset previous errors
    await db.commit()

    # 9. Dispatch async Celery task
    evaluate_candidate_practical_task.delay(
        str(id),
        github_url,
        jd_skills,
        task_skills,
        recruiter_email=recruiter_email,
        eval_id=eval_id,
    )

    return {
        "message": "GitHub repository evaluation task has been triggered successfully in the background.",
        "candidate_stage_id": id,
        "github_url": github_url,
        "status": "processing",
        "evaluation_id": eval_id,
    }
