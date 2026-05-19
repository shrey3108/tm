import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.v1.db.session import get_db
from app.v1.db.models.evaluations import Evaluation
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.hr_decisions import HrDecision
from app.v1.db.models.job_stage_configs import JobStageConfig
from app.v1.schemas.candidate_stages import StageOverrideCreate, StageDecisionCreate, EvaluationRead
from app.v1.schemas.user import UserRead
from app.v1.dependencies import check_permission
from app.v1.services.admin_service import admin_service
from app.v1.services.hr_decision_service import HRDecisionService
from app.v1.schemas.hr_decision import HRDecisionCreate

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
        raise HTTPException(status_code=404, detail="Evaluation not found for this candidate stage")
    return evaluation


from typing import List

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
    if not evaluations:
        raise HTTPException(status_code=404, detail="No evaluations found for this candidate stage")
    return list(evaluations)


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
    from app.v1.db.models.job_stage_configs import JobStageConfig
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

