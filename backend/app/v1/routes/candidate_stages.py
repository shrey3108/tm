import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel
from sqlalchemy import select, delete, text
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
from app.v1.schemas.candidate_stages import (
    StageOverrideCreate,
    StageDecisionCreate,
    EvaluationRead,
    SendToAssociatesRequest,
    SendToAssociatesResponse,
    AssociateEmailResult,
)
from app.v1.schemas.associate_review import (
    AssociateResultsResponse,
    AssociateReviewResult,
    QuestionMark,
)
from app.v1.schemas.user import UserRead
from app.v1.dependencies import check_permission
from app.v1.services.admin_service import admin_service
from app.v1.services.hr_decision_service import HRDecisionService
from app.v1.schemas.hr_decision import HRDecisionCreate
from app.v1.services.evaluation_tasks import evaluate_candidate_practical_task
from app.v1.db.models.associates import Associate
from app.v1.db.models.associate_evaluations import AssociateEvaluation
from app.v1.services.email_service import send_associate_notification_email
from app.v1.services.admin.audit_service import audit_service

router = APIRouter(prefix="/candidate-stages", tags=["candidate-stages"])

@router.get("/{id}/evaluation")
async def get_candidate_stage_evaluation(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:read")),
) -> EvaluationRead:
    """Retrieve the full evaluation result for a specific candidate stage."""
    stage = await db.get(CandidateStage, id)
    if not stage:
        raise HTTPException(status_code=404, detail="Candidate stage not found")

    if stage.status in ("processing", "queued", "submitted"):
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=202, 
            content={"status": stage.status, "detail": f"Evaluation is currently {stage.status}"}
        )

    # If evaluation_data has an evaluation_id it means submission succeeded but evaluation hasn't finished yet
    if isinstance(stage.evaluation_data, dict) and stage.evaluation_data.get("evaluation_id") and stage.status not in ("completed", "failed"):
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=202,
            content={"status": "processing", "detail": "Evaluation is currently processing"}
        )

    res = await db.execute(
        select(Evaluation)
        .where(Evaluation.candidate_stage_id == id)
        .order_by(Evaluation.attempt_number.desc())
    )
    evaluation = res.scalars().first()

    if not evaluation:
        if stage.status == "failed" and isinstance(stage.evaluation_data, dict) and "error" in stage.evaluation_data:
            # Construct a mock Evaluation dict with the error details conforming to EvaluationRead
            return {
                "id": id,  # Use stage id as a dummy evaluation id
                "candidate_stage_id": id,
                "attempt_number": 1,
                "overall_score": 0.0,
                "result": "pending",
                "status": "failed",
                "error_message": stage.evaluation_data.get('error'),
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
            
        raise HTTPException(status_code=404, detail="Evaluation not found for this candidate stage")
        
    return evaluation

from fastapi.responses import HTMLResponse

@router.get("/{id}/evaluation/report", response_class=HTMLResponse)
async def get_candidate_stage_evaluation_report(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve the AI evaluation report as a standalone HTML page (publicly accessible via unguessable UUID)."""
    stage = await db.get(CandidateStage, id)
    if not stage:
        raise HTTPException(status_code=404, detail="Candidate stage not found")
        
    res = await db.execute(
        select(Evaluation)
        .where(Evaluation.candidate_stage_id == id)
        .order_by(Evaluation.attempt_number.desc())
    )
    evaluation = res.scalars().first()
    
    if not evaluation:
        return HTMLResponse("<html><body><h2>Evaluation not found or still processing</h2></body></html>", status_code=404)

    eval_data = evaluation.structured_evaluation_data
    if not isinstance(eval_data, dict):
        return HTMLResponse("<html><body><h2>Invalid evaluation data format</h2></body></html>", status_code=400)
        
    jd_skills = eval_data.get("JD Skills", [])
    project_skills = eval_data.get("Project requirements skills", [])
    
    def render_column(items, category_class):
        html_output = ""
        for item in items:
            for category, details in item.items():
                if category in ["alignment_review", "strengths", "weaknesses", "suggested_followups"]:
                    continue
                score = details.get("score", 0)
                reasoning = details.get("reasoning", "No reasoning provided.")
                display_cat = category.replace("_", " ").title()
                
                html_output += f'''
                <div class="accordion-item {category_class}" style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden;">
                    <button class="accordion-header" onclick="toggleAccordion(this, '{category_class}')" style="width: 100%; text-align: left; background: none; border: none; cursor: pointer; display: flex; justify-content: space-between; align-items: center; padding: 16px; outline: none;">
                        <span style="font-weight: 600; color: #1f2937; font-size: 16px;">{display_cat}</span>
                        <span style="background-color: #d1fae5; color: #065f46; padding: 4px 10px; border-radius: 9999px; font-weight: 700; font-size: 14px;">{score}/5.0</span>
                    </button>
                    <div class="accordion-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
                        <div style="font-size: 14px; color: #4b5563; line-height: 1.6; padding: 0 16px 16px 16px; border-top: 1px solid #f3f4f6; margin-top: 0;">
                            {reasoning}
                        </div>
                    </div>
                </div>
                '''
        return html_output

    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Detailed AI Code Evaluation</title>
        <style>
            body {{
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                background-color: #f9fafb;
                color: #111827;
                margin: 0;
                padding: 40px 20px;
            }}
            .container {{
                max-width: 1000px;
                margin: 0 auto;
            }}
            .header-banner {{
                background-color: #16a34a;
                color: white;
                padding: 20px 30px;
                border-radius: 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 30px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            }}
            .header-title {{
                font-size: 24px;
                font-weight: 700;
                margin: 0;
            }}
            .score-badge {{
                background-color: white;
                color: #16a34a;
                padding: 8px 16px;
                border-radius: 8px;
                font-size: 18px;
                font-weight: 700;
            }}
            .columns {{
                display: flex;
                gap: 30px;
            }}
            .column {{
                flex: 1;
            }}
            .column-header {{
                font-size: 20px;
                font-weight: 600;
                color: #374151;
                margin-bottom: 20px;
                padding-bottom: 10px;
                border-bottom: 2px solid #e5e7eb;
            }}
            @media (max-width: 768px) {{
                .columns {{
                    flex-direction: column;
                }}
            }}
        </style>
        <script>
            function toggleAccordion(header, categoryClass) {{
                const item = header.parentElement;
                const content = item.querySelector('.accordion-content');
                const isOpen = item.classList.contains('active');
                // Close all other accordions in the same category
                document.querySelectorAll('.' + categoryClass).forEach(otherItem => {{
                    if (otherItem !== item && otherItem.classList.contains('active')) {{
                        otherItem.classList.remove('active');
                        const otherContent = otherItem.querySelector('.accordion-content');
                        otherContent.style.maxHeight = '0px';
                    }}
                }});
                if (isOpen) {{
                    item.classList.remove('active');
                    content.style.maxHeight = '0px';
                }} else {{
                    item.classList.add('active');
                    content.style.maxHeight = content.scrollHeight + 'px';
                }}
            }}
        </script>
    </head>
    <body>
        <div class="container">
            <div class="header-banner">
                <h1 class="header-title">AI Code Evaluation Report</h1>
                <div class="score-badge">Overall Score: {evaluation.overall_score}/5.0</div>
            </div>
            
            <div class="columns">
                <div class="column">
                    <h2 class="column-header">Job Description Alignment</h2>
                   {render_column(jd_skills, "accordion-jd")}
                </div>
                <div class="column">
                    <h2 class="column-header">Project Task Alignment</h2>
                    {render_column(project_skills, "accordion-project")}
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)

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
            "result": "error",
            "status": "failed",
            "error_message": stage.evaluation_data.get('error'),
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
    elif stage and stage.status in ("pending", "processing"):
        # Create a mock evaluation for the processing state so the UI doesn't return 404
        next_version = (evaluations_list[0].attempt_number + 1) if evaluations_list else 1
        
        mock_eval = {
            "id": id,  # Use stage id as a dummy evaluation id
            "candidate_stage_id": id,
            "version": next_version,
            "overall_score": 0.0,
            "result": "pending",
            "status": "processing",
            "error_message": None,
            "structured_evaluation_data": {},
            "created_at": stage.completed_at or stage.started_at or datetime.now(timezone.utc),
            "highlights": {
                "overall_summary": "Evaluation is currently processing. Please wait...",
                "recommendation": "Processing...",
                "strengths": [],
                "weaknesses": [],
                "suggested_followups": []
            }
        }
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


from app.v1.utils.stage import get_stage_required_inputs


def is_practical_evaluation(stage: CandidateStage) -> bool:
    """Determine if a stage is configured for Technical Practical / GitHub Evaluation."""
    if not stage.job_stage:
        return False
    config = stage.job_stage.config or {}
    if not config and stage.job_stage.template:
        config = stage.job_stage.template.default_config or {}
        
    template_name = stage.job_stage.template.name if stage.job_stage.template else None
    required_inputs = get_stage_required_inputs(config, template_name)
    return "github" in required_inputs



class GitHubEvaluationRequest(BaseModel):
    github_url: str | None = None

@router.post("/{id}/submit-github")
async def submit_candidate_github_repo(
    id: uuid.UUID,
    payload: GitHubEvaluationRequest,
    db: AsyncSession = Depends(get_db),
    # Candidates might submit this, but assuming existing permission for now or anonymous if no auth.
    # Leaving same permission for backward compatibility if HR submits on their behalf.
    user: UserRead = Depends(check_permission("candidates:decide")),
) -> Any:
    """Submit a GitHub repository URL for the Technical Practical Round without triggering evaluation."""
    stmt = select(CandidateStage).options(
        selectinload(CandidateStage.job_stage).options(
            selectinload(JobStageConfig.job),
            selectinload(JobStageConfig.template),
        ),
        selectinload(CandidateStage.candidate)
    ).where(CandidateStage.id == id)
    
    res = await db.execute(stmt)
    stage = res.scalars().first()

    if not stage:
        raise HTTPException(status_code=404, detail="Candidate stage not found")

    if not is_practical_evaluation(stage):
        raise HTTPException(status_code=400, detail="This stage is not configured for Technical Practical Round evaluation.")

    github_url = payload.github_url
    if not github_url:
        raise HTTPException(status_code=400, detail="GitHub URL not found.")

    candidate = stage.candidate
    candidate.task_file_path = github_url

    stage.status = "submitted"
    
    eval_data = stage.evaluation_data if isinstance(stage.evaluation_data, dict) else {}
    eval_data["github_url"] = github_url
    eval_data["submitted_at"] = datetime.now(timezone.utc).isoformat()
    stage.evaluation_data = eval_data

    await db.commit()

    return {
        "message": "GitHub repository successfully submitted.",
        "candidate_stage_id": id,
        "status": "submitted"
    }

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
                selectinload(JobStageConfig.job).options(
                    selectinload(Job.skills),
                    selectinload(Job.position),
                ),
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

    # 2. Verify stage is a Technical Practical / GitHub Round
    if not is_practical_evaluation(stage):
        stage_template_name = stage.job_stage.template.name if stage.job_stage and stage.job_stage.template else None
        raise HTTPException(
            status_code=400,
            detail=f"This stage is not configured for Technical Practical Round evaluation (found: {stage_template_name}).",
        )

    candidate = stage.candidate
    job = stage.job_stage.job

    if not candidate or not job:
        raise HTTPException(status_code=400, detail="Candidate or Job association missing.")

    # 3. Resolve GitHub URL from payload or evaluation_data
    github_url = payload.github_url
    if not github_url and stage.evaluation_data and isinstance(stage.evaluation_data, dict):
        github_url = stage.evaluation_data.get("github_url")
        
    if not github_url:
        raise HTTPException(
            status_code=400,
            detail="GitHub URL not found. Please provide a valid GitHub repository URL in the request body or submit it first.",
        )

    # 4. Save/update candidate task_file_path with the solution repo URL if not already saved
    if candidate.task_file_path != github_url:
        candidate.task_file_path = github_url
        await db.commit()

    from app.v1.services.github_eval_service import trigger_github_evaluation
    recruiter_email = user.email if user else None
    return await trigger_github_evaluation(db, stage, github_url, recruiter_email)

    # 5. Fetch all papers in CandidateTestPaperHistory for this candidate and stage


@router.post("/{id}/retry")
async def retry_candidate_stage_evaluation(
    id: uuid.UUID = Path(..., description="The UUID of the Candidate Stage to retry"),
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:decide")),
) -> Any:
    """Retry a failed evaluation for a candidate stage without re-entering inputs."""
    stage = await db.get(CandidateStage, id)
    if not stage:
         raise HTTPException(status_code=404, detail="Candidate stage not found")
         
    # Fetch job stage to determine template
    await db.refresh(stage, ["job_stage"])
    if not stage.job_stage:
        raise HTTPException(status_code=400, detail="Candidate stage is missing job stage configuration.")
        
    await db.refresh(stage.job_stage, ["template"])
    
    if is_practical_evaluation(stage):
        # Retry GitHub evaluation using the previously saved github_url
        saved_url = None
        if stage.evaluation_data and isinstance(stage.evaluation_data, dict):
            saved_url = stage.evaluation_data.get("github_url")
        if not saved_url:
            raise HTTPException(
                status_code=400,
                detail="GitHub URL not found. Please provide a valid GitHub repository URL in the request body.",
            )
        payload = GitHubEvaluationRequest(github_url=saved_url)
        return await evaluate_candidate_github_repo(id, payload, db, user)
        
    else:
        # Retry Transcript evaluation
        from app.v1.services.evaluation_tasks import evaluate_candidate_transcript_task
        stage.status = "processing"
        
        # Keep any existing data but clear errors
        eval_data = stage.evaluation_data if isinstance(stage.evaluation_data, dict) else {}
        if "error" in eval_data:
            del eval_data["error"]
        if "status" in eval_data:
            del eval_data["status"]
            
        stage.evaluation_data = eval_data
        await db.commit()
        
        evaluate_candidate_transcript_task.delay(str(id))
        return {
            "message": "Transcript evaluation retry triggered.",
            "candidate_stage_id": id,
            "status": "processing"
        }


@router.delete("/{id}/results")
async def delete_candidate_stage_results(
    id: uuid.UUID = Path(..., description="The UUID of the Candidate Stage to reset/delete results for"),
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:decide")),
) -> Any:
    """Delete all evaluation results and decisions for a candidate stage, resetting its status to pending."""
    # 1. Fetch CandidateStage
    stage = await db.get(CandidateStage, id)
    if not stage:
        raise HTTPException(status_code=404, detail="Candidate stage not found")

    # 2. Delete linked Evaluations
    await db.execute(
        delete(Evaluation).where(Evaluation.candidate_stage_id == id)
    )

    # 3. Delete linked HR Decisions
    await db.execute(
        delete(HrDecision).where(
            HrDecision.candidate_id == stage.candidate_id,
            HrDecision.stage_config_id == stage.job_stage_id
        )
    )

    # 4. Reset CandidateStage status and data
    stage.status = "pending"
    stage.evaluation_data = None
    stage.completed_at = None

    await db.commit()

    # 5. Invalidate Job Cache if stage config is available
    try:
        await db.refresh(stage, ["job_stage"])
        if stage.job_stage:
            from app.v1.services.admin.system_service import system_service
            await system_service.invalidate_job_cache(stage.job_stage.job_id)
    except Exception as e:
        get_logger(__name__).warning(f"Failed to invalidate cache: {e}")

    return {
        "message": f"Successfully deleted all results and reset candidate stage {id} to pending.",
        "candidate_stage_id": id,
        "status": "pending"
    }


@router.post("/{id}/send-to-associates", response_model=SendToAssociatesResponse)
async def send_paper_to_associates(
    id: uuid.UUID,
    payload: SendToAssociatesRequest,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:decide")),
) -> Any:
    """Send the default test paper + candidate GitHub URL to multiple associates via email.

    Used for the GitHub + Question round where associates need the paper and the
    candidate's GitHub repository link to evaluate the submission.
    """
    # 1. Fetch CandidateStage with eager relationships
    stmt = (
        select(CandidateStage)
        .options(
            selectinload(CandidateStage.job_stage).options(
                selectinload(JobStageConfig.job).options(
                    selectinload(Job.skills),
                    selectinload(Job.position),
                ),
                selectinload(JobStageConfig.template),
            ),
            selectinload(CandidateStage.candidate),
        )
        .where(CandidateStage.id == id)
    )
    res = await db.execute(stmt)
    stage = res.scalars().first()

    if not stage:
        raise HTTPException(status_code=404, detail="Candidate stage not found")

    candidate = stage.candidate
    if not candidate:
        raise HTTPException(status_code=400, detail="Candidate association missing.")

    # 2. Resolve GitHub URL from the saved stage evaluation_data
    #    (saved automatically when evaluate-github endpoint runs, if applicable)
    github_url = None
    if stage.evaluation_data and isinstance(stage.evaluation_data, dict):
        github_url = stage.evaluation_data.get("github_url")

    # 3. Fetch the default test paper for this job stage
    #    (CandidateTestPaper where candidate_id IS NULL = job-level default)
    test_paper = None
    target_job_id = stage.job_stage.job_id if stage.job_stage else candidate.applied_job_id
    if target_job_id:
        stmt_job = select(CandidateTestPaper).where(
            CandidateTestPaper.job_id == target_job_id,
            CandidateTestPaper.candidate_id.is_(None),
        )
        if stage.job_stage_id:
            # Try stage-specific paper first
            stmt_job_stage = stmt_job.where(CandidateTestPaper.job_stage_config_id == stage.job_stage_id)
            res_job = await db.execute(stmt_job_stage)
            test_paper = res_job.scalar_one_or_none()
            if not test_paper:
                # Fallback to NULL stage paper
                stmt_job_none = stmt_job.where(CandidateTestPaper.job_stage_config_id.is_(None))
                res_job = await db.execute(stmt_job_none)
                test_paper = res_job.scalar_one_or_none()
        else:
            stmt_job = stmt_job.where(CandidateTestPaper.job_stage_config_id.is_(None))
            res_job = await db.execute(stmt_job)
            test_paper = res_job.scalar_one_or_none()

    if not test_paper:
        raise HTTPException(
            status_code=400,
            detail="No default test paper found for this job stage. Please assign a test paper first.",
        )

    # 4. Fetch associates by IDs
    stmt_assoc = select(Associate).where(Associate.id.in_(payload.associate_ids))
    res_assoc = await db.execute(stmt_assoc)
    associates = res_assoc.scalars().all()

    if not associates:
        raise HTTPException(
            status_code=404,
            detail="No associates found for the provided IDs.",
        )

    # 5. Send email to each associate
    candidate_full_name = f"{candidate.first_name or 'Candidate'} {candidate.last_name or ''}".strip()
    sent_results: list[AssociateEmailResult] = []
    failed_results: list[AssociateEmailResult] = []

    for associate in associates:
        try:
            # Create an AssociateEvaluation record with a unique review token.
            # This token is used to build the link to the review form (no auth required).
            evaluation = AssociateEvaluation(
                candidate_stage_id=stage.id,
                associate_id=associate.id,
                test_paper_id=test_paper.id,
                candidate_id=candidate.id,
                job_id=stage.job_stage.job_id if stage.job_stage else candidate.applied_job_id,
            )
            db.add(evaluation)
            await db.flush()  # populate review_token + id

            await send_associate_notification_email(
                associate_name=associate.name,
                associate_email=associate.email,
                candidate=candidate,
                test_paper=test_paper,
                github_url=github_url,
                workdrive_url=payload.workdrive_url,
                review_token=evaluation.review_token,
                db=db,
                stage_job_id=stage.job_stage.job_id if stage.job_stage else None,
                stage_name=stage.job_stage.template.name if stage.job_stage and stage.job_stage.template else None,
            )
            sent_results.append(
                AssociateEmailResult(
                    associate_id=associate.id,
                    name=associate.name,
                    email=associate.email,
                    status="sent",
                )
            )
        except Exception as e:
            get_logger(__name__).exception(
                f"Failed to send paper email to associate {associate.email}: {e}"
            )
            failed_results.append(
                AssociateEmailResult(
                    associate_id=associate.id,
                    name=associate.name,
                    email=associate.email,
                    status="failed",
                    error=str(e),
                )
            )

    # 6. Log audit entry
    try:
        await audit_service.log_action(
            db=db,
            user_id=user.id,
            action="send_paper_to_associates",
            entity_type="candidate_stage",
            entity_id=id,
            details={
                "candidate_name": candidate_full_name,
                "github_url": github_url,
                "workdrive_url": payload.workdrive_url,
                "paper_id": str(test_paper.id),
                "paper_name": test_paper.name,
                "associate_count": len(associates),
                "sent_count": len(sent_results),
                "failed_count": len(failed_results),
            },
        )
    except Exception as e:
        get_logger(__name__).warning(f"Failed to log audit entry: {e}")
    finally:
        # Always commit so AssociateEvaluation records (with review tokens)
        # are persisted even if audit logging fails.
        await db.commit()

    # 7. Build response
    if not sent_results and failed_results:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send any emails. Error sample: {failed_results[0].error}",
        )

    return SendToAssociatesResponse(
        status="success",
        message=f"Test paper + GitHub URL email processed: {len(sent_results)} sent, {len(failed_results)} failed.",
        candidate_stage_id=id,
        candidate_name=candidate_full_name,
        github_url=github_url,
        paper_id=test_paper.id,
        paper_name=test_paper.name,
        sent_to=sent_results,
        failed=failed_results,
    )


@router.get("/{id}/associate-results", response_model=AssociateResultsResponse)
async def get_associate_results(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:decide")),
) -> Any:
    """Retrieve all associate evaluation results for a candidate stage.

    Returns 404 if no AssociateEvaluation records exist for this stage (i.e. no
    email was ever sent to associates). Each review includes per-question marks,
    total marks, sent/submitted timestamps, and pass/fail result.
    """
    # 1. Fetch the CandidateStage with eager relationships for job info
    stmt = (
        select(CandidateStage)
        .options(
            selectinload(CandidateStage.job_stage).options(
                selectinload(JobStageConfig.job).options(
                    selectinload(Job.department),
                    selectinload(Job.position),
                ),
            ),
            selectinload(CandidateStage.candidate),
        )
        .where(CandidateStage.id == id)
    )
    res = await db.execute(stmt)
    stage = res.scalars().first()

    if not stage:
        raise HTTPException(status_code=404, detail="Candidate stage not found")

    candidate = stage.candidate
    if not candidate:
        raise HTTPException(status_code=400, detail="Candidate association missing.")

    # 2. Fetch all AssociateEvaluation records for this stage (eager-load associate + job)
    eval_stmt = (
        select(AssociateEvaluation)
        .options(
            selectinload(AssociateEvaluation.associate),
            selectinload(AssociateEvaluation.job).options(
                selectinload(Job.department),
                selectinload(Job.position),
            ),
        )
        .where(AssociateEvaluation.candidate_stage_id == id)
        .order_by(AssociateEvaluation.sent_at)
    )
    eval_res = await db.execute(eval_stmt)
    evaluations = eval_res.scalars().all()

    # 3. Return 404 if no records exist (no email was sent to associates)
    if not evaluations:
        raise HTTPException(
            status_code=404,
            detail="No associate evaluations found for this candidate stage. "
            "Please send the test paper to associates first.",
        )

    # 4. Resolve candidate name
    candidate_full_name = f"{candidate.first_name or 'Candidate'} {candidate.last_name or ''}".strip()

    # 5. Resolve job info (job_name, department, position) from the first evaluation's job
    job = evaluations[0].job
    job_name = ""
    department_name = ""
    position_name = ""
    if job:
        job_name = job.title or ""
        if job.department:
            department_name = job.department.name or ""
        if job.position:
            position_name = job.position.name or ""

    # 6. Fetch job_skills weightages for skill-weighted marks computation.
    #    Each question's weight = its skill's weightage (from job_skills).
    #    We then normalize all question weights to a 100 basis so the final
    #    weighted score is directly comparable across papers.
    job_id = evaluations[0].job_id
    skill_weightages: dict[str, float] = {}
    if job_id:
        js_query = text(
            "SELECT skill_id, weightage FROM job_skills WHERE job_id = :job_id"
        )
        js_res = await db.execute(js_query, {"job_id": job_id})
        skill_weightages = {
            str(row[0]): float(row[1]) for row in js_res.fetchall()
        }

    # 7. Resolve github_url from stage.evaluation_data
    github_url = None
    if stage.evaluation_data and isinstance(stage.evaluation_data, dict):
        github_url = stage.evaluation_data.get("github_url")

    # Default weightage for skills not found in job_skills or for
    # questions without any skill_ids tagging.
    _DEFAULT_SKILL_WEIGHT = 10.0

    # 8. Build review result list
    reviews: list[AssociateReviewResult] = []
    submitted_count = 0
    for ev in evaluations:
        associate = ev.associate

        # Parse marks JSONB into QuestionMark list with skill-weighted fields.
        question_marks: list[QuestionMark] | None = None
        weighted_total: Optional[float] = None
        weighted_max_total: Optional[float] = None
        weighted_result_out_of_5: Optional[float] = None

        if ev.marks:
            question_marks = []

            # --- First pass: compute raw weight per question ---
            # raw_weight = average of the skill weightages tagged on the
            # question.  Questions without skill_ids get the default weight.
            raw_weights: list[float] = []
            for m in ev.marks:
                if not isinstance(m, dict):
                    raw_weights.append(_DEFAULT_SKILL_WEIGHT)
                    continue
                s_ids = m.get("skill_ids")
                if s_ids:
                    weights = [
                        skill_weightages.get(str(sid), _DEFAULT_SKILL_WEIGHT)
                        for sid in s_ids
                    ]
                    raw_w = sum(weights) / len(weights) if weights else 0.0
                else:
                    raw_w = _DEFAULT_SKILL_WEIGHT
                raw_weights.append(raw_w)

            # --- Normalize to 100 basis ---
            # new_question_weight = old_question_weight / total * 100
            total_raw_weight = sum(raw_weights)
            normalized_weights: list[float] = []
            if total_raw_weight > 0:
                for rw in raw_weights:
                    normalized_weights.append((rw / total_raw_weight) * 100)
            else:
                # Fallback: equal weights when all raw weights are zero.
                n = len(raw_weights)
                normalized_weights = (
                    [100.0 / n] * n if n > 0 else []
                )

            # --- Second pass: build QuestionMark objects ---
            w_total = 0.0
            w_max = 0.0
            for idx, m in enumerate(ev.marks):
                if not isinstance(m, dict):
                    continue
                max_m = m.get("max_marks")
                awarded = m.get("awarded_marks")
                sw = (
                    normalized_weights[idx]
                    if idx < len(normalized_weights)
                    else 0.0
                )

                w_marks: Optional[float] = None
                w_max_q: Optional[float] = None
                if max_m is not None and max_m > 0:
                    # This question is scorable.
                    w_max_q = sw
                    w_max += sw
                    if awarded is not None:
                        w_marks = (awarded / max_m) * sw
                        w_total += w_marks

                question_marks.append(
                    QuestionMark(
                        item_type=str(m.get("item_type", "question")),
                        question_text=str(m.get("question_text", "")),
                        max_marks=max_m,
                        awarded_marks=awarded,
                        skill_ids=m.get("skill_ids"),
                        skill_weight=round(sw, 2),
                        weighted_marks=(
                            round(w_marks, 2) if w_marks is not None else None
                        ),
                        weighted_max=(
                            round(w_max_q, 2) if w_max_q is not None else None
                        ),
                    )
                )

            # Compute aggregate weighted scores and convert to a scale of 5
            # so the result is easy to interpret (e.g. 40/60 -> 3.33 out of 5).
            if w_max > 0:
                weighted_total = round(w_total, 2)
                weighted_max_total = round(w_max, 2)
                weighted_result_out_of_5 = round((w_total / w_max) * 5, 2)

        if ev.status == "submitted":
            submitted_count += 1

        percentage: Optional[float] = None
        if ev.total_marks is not None and ev.max_total_marks and ev.max_total_marks > 0:
            percentage = round((ev.total_marks / ev.max_total_marks) * 100, 2)

        reviews.append(
            AssociateReviewResult(
                id=ev.id,
                review_token=ev.review_token,
                associate_id=ev.associate_id,
                associate_name=associate.name if associate else "Unknown",
                associate_email=associate.email if associate else "",
                sent_at=ev.sent_at,
                submitted_at=ev.submitted_at,
                status=ev.status,
                marks=question_marks,
                total_marks=ev.total_marks,
                max_total_marks=ev.max_total_marks,
                percentage=percentage,
                result=ev.result,
                weighted_total=weighted_total,
                weighted_max=weighted_max_total,
                weighted_result_out_of_5=weighted_result_out_of_5,
            )
        )

    # 9. Build and return response
    return AssociateResultsResponse(
        candidate_stage_id=id,
        candidate_name=candidate_full_name,
        job_name=job_name,
        department=department_name,
        position=position_name,
        github_url=github_url,
        reviews=reviews,
        total_associates=len(reviews),
        submitted_count=submitted_count,
    )
