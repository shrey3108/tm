import uuid
from datetime import datetime
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.v1.db.models.hr_decisions import HrDecision
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.job_stage_configs import JobStageConfig
from app.v1.db.models.stage_templates import StageTemplate
from app.v1.schemas.hr_decision import (
    HRDecisionCreate,
    HRDecisionResponse,
    HRDecisionHistoryResponse,
    HRDecisionUpdate,
)
from app.v1.core.logging import get_logger
from app.v1.services.candidate_stage_service import candidate_stage_service
from app.v1.services.admin.system_service import system_service
from app.v1.services.hr_decision_workflows import (
    trigger_cross_match_for_candidate_impl,
    handle_multi_job_auto_failure_impl,
    handle_email_based_global_failure_impl,
)

logger = get_logger(__name__)


async def create_decision_impl(
    db: AsyncSession,
    candidate_id: uuid.UUID,
    decision_data: HRDecisionCreate,
    user_id: uuid.UUID,
    stage_config_id: uuid.UUID | None = None,
) -> HRDecisionResponse:
    """Create a new HR decision with validation."""
    # 1. Validate candidate exists
    candidate_result = await db.execute(
        select(Candidate)
        .options(selectinload(Candidate.resumes))
        .where(Candidate.id == candidate_id)
    )
    candidate = candidate_result.scalar_one_or_none()
    if not candidate:
        raise ValueError(f"Candidate with id {candidate_id} not found")

    # 2. Determine the job context
    actual_job_id = getattr(decision_data, "job_id", None) or getattr(
        candidate, "applied_job_id", None
    )

    # 3. Smart ID Resolution: if they passed a CandidateStage ID instead of a Config ID, fix it
    if stage_config_id:
        cs_check = await db.get(CandidateStage, stage_config_id)
        if cs_check and cs_check.job_stage_id:
            stage_config_id = cs_check.job_stage_id
    else:
        # If no stage_config_id is provided, try to default to the Resume Screening stage (Order 0)
        if actual_job_id:
            stage_zero_stmt = (
                select(JobStageConfig.id)
                .join(StageTemplate, JobStageConfig.template_id == StageTemplate.id)
                .where(JobStageConfig.job_id == actual_job_id)
                .where(
                    or_(
                        JobStageConfig.stage_order == 1,
                        StageTemplate.name == "Resume Screening"
                    )
                )
                .limit(1)
            )
            stage_zero_id = await db.scalar(stage_zero_stmt)
            if stage_zero_id:
                stage_config_id = stage_zero_id

    # Check "May Be" decision limit (only 1 per candidate per stage)
    if decision_data.decision == "May Be":
        query = select(func.count(HrDecision.id)).where(
            HrDecision.candidate_id == candidate_id, HrDecision.decision == "May Be"
        )
        if stage_config_id:
            query = query.where(HrDecision.stage_config_id == stage_config_id)
        elif actual_job_id:
            query = query.where(HrDecision.job_id == actual_job_id, HrDecision.stage_config_id.is_(None))

        existing_may_be = await db.execute(query)
        may_be_count = existing_may_be.scalar() or 0

        if may_be_count >= 1:
            stage_msg = f" for the current stage" if stage_config_id else " for resume screening"
            raise ValueError(
                f"Only one 'May Be' decision is allowed per candidate{stage_msg}."
            )

    # Check "pass" decision limit (only 1 per candidate per stage for THIS job)
    if decision_data.decision.lower() == "pass" and actual_job_id:
        query = select(func.count(HrDecision.id)).where(
            HrDecision.candidate_id == candidate_id,
            HrDecision.job_id == actual_job_id,
            func.lower(HrDecision.decision) == "pass",
        )

        if stage_config_id:
            query = query.where(HrDecision.stage_config_id == stage_config_id)
        else:
            query = query.where(HrDecision.stage_config_id.is_(None))
        
        existing_approve = await db.execute(query)
        approve_count = existing_approve.scalar() or 0

        if approve_count >= 1:
            stage_msg = f" for this stage" if stage_config_id else " for resume screening"
            raise ValueError(
                f"This candidate has already passed{stage_msg}. "
            )

    # Create the decision
    hr_decision = HrDecision(
        candidate_id=candidate_id,
        stage_config_id=stage_config_id,
        job_id=actual_job_id,
        user_id=user_id,
        decision=decision_data.decision,
        notes=decision_data.notes,
        score=decision_data.score,
    )

    db.add(hr_decision)
    await db.flush() # Flush to get ID, but don't commit yet
    await db.refresh(hr_decision)

    logger.info(
        f"Created HR decision: {decision_data.decision} for candidate {candidate_id} "
        f"by user {user_id}"
    )

    # Handle auto-rejection from other jobs if this one is passed (Global Email-based Exclusivity)
    if decision_data.decision.lower() == "pass" and actual_job_id:
        await handle_email_based_global_failure_impl(db, candidate.email, actual_job_id, user_id)

    # Trigger stage advancement in the pipeline
    if decision_data.decision.lower() in ["pass", "fail"]:
        # 1. Find the candidate stage to advance
        cs_stmt = select(CandidateStage).where(CandidateStage.candidate_id == candidate_id)
        if stage_config_id:
            cs_stmt = cs_stmt.options(selectinload(CandidateStage.job_stage)).where(CandidateStage.job_stage_id == stage_config_id)
        else:
            # Fallback: Find the currently active or pending stage for this job
            cs_stmt = (
                cs_stmt.join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
                .options(selectinload(CandidateStage.job_stage))
                .where(JobStageConfig.job_id == actual_job_id)
                .where(CandidateStage.status.in_(["pending", "active"]))
                .order_by(JobStageConfig.stage_order.asc())
            )
        
        cs_res = await db.execute(cs_stmt)
        cs_to_advance = cs_res.scalars().first()

        if cs_to_advance:
            success = decision_data.decision.lower() == "pass"
            
            # Check if this is a Resume Screening decision for a job with no Stage 0 configuration
            is_resume_screening_decision = (stage_config_id is None)
            
            is_stage_zero = False
            if cs_to_advance.job_stage and cs_to_advance.job_stage.stage_order == 1:
                is_stage_zero = True

            if is_resume_screening_decision and not is_stage_zero:
                # If this is a Resume Screening decision and the candidate stage is not Stage 0 (e.g. Stage 1 - HR Round):
                # - If passed: ensure the stage is active, do not mark completed.
                # - If failed: mark the stage as failed.
                if success:
                    if cs_to_advance.status == "pending":
                        cs_to_advance.status = "active"
                        cs_to_advance.started_at = datetime.utcnow()
                        
                        st_stmt = (
                            select(StageTemplate.name)
                            .select_from(JobStageConfig)
                            .join(StageTemplate, JobStageConfig.template_id == StageTemplate.id)
                            .where(JobStageConfig.id == cs_to_advance.job_stage_id)
                        )
                        st_name = (await db.execute(st_stmt)).scalar()
                        if candidate and st_name:
                             candidate.current_status = f"{st_name} (Active)"
                    await db.commit()
                else:
                    await candidate_stage_service.advance_candidate(db, candidate_id, cs_to_advance.id, success=False)
                    await db.commit()
            else:
                # ALWAYS advance immediately when a decision is recorded for a stage!
                await candidate_stage_service.advance_candidate(db, candidate_id, cs_to_advance.id, success=success)
                await db.commit()

        elif decision_data.decision.lower() == "pass":
            # Only initiate pipeline if NO stages exist at all for this job
            existing_stages_stmt = (
                select(CandidateStage)
                .select_from(CandidateStage)
                .join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
                .where(JobStageConfig.job_id == actual_job_id, CandidateStage.candidate_id == candidate_id)
            )
            existing_stages = (await db.execute(existing_stages_stmt)).scalars().all()
            
            if not existing_stages:
                await candidate_stage_service.initiate_candidate_pipeline(db, candidate_id, actual_job_id)
                
                # Resume Screening is now Stage 0, approving it should COMPLETE it 
                # and advance to the next stage (Stage 1 - HR Round)
                first_stage_stmt = (
                    select(CandidateStage)
                    .select_from(CandidateStage)
                    .join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
                    .options(selectinload(CandidateStage.job_stage))
                    .where(JobStageConfig.job_id == actual_job_id, CandidateStage.candidate_id == candidate_id)
                    .order_by(JobStageConfig.stage_order.asc())
                    .limit(1)
                )
                first_stage = (await db.execute(first_stage_stmt)).scalar_one_or_none()
                if first_stage:
                    # Advance from Stage 0 to Stage 1 immediately
                    await candidate_stage_service.advance_candidate(db, candidate_id, first_stage.id, success=True)
                    await db.commit()
                    logger.info(f"Initiated pipeline and advanced from Stage 0 (Resume) for candidate {candidate_id}")

        # Trigger cross-match in background if failed/rejected
        if decision_data.decision.lower() == "fail":
            logger.info(f"Failure detected. Triggering automatic cross-job discovery for candidate {candidate_id} from job context {actual_job_id}.")
            trigger_cross_match_for_candidate_impl(candidate, job_id=actual_job_id)

    # FINAL COMMIT: Save everything (decision + advancement) together
    await db.commit()
    
    # Reload with relationships for the response
    final_stmt = select(HrDecision).where(HrDecision.id == hr_decision.id).options(
        selectinload(HrDecision.user),
        selectinload(HrDecision.stage_config).selectinload(JobStageConfig.template)
    )
    final_res = await db.execute(final_stmt)
    hr_decision_final = final_res.scalar_one()

    # Invalidate cache for the job
    if actual_job_id:
        await system_service.invalidate_job_cache(actual_job_id)

    return HRDecisionResponse.model_validate(hr_decision_final)


async def get_decision_history_impl(
    db: AsyncSession,
    candidate_id: uuid.UUID,
    job_id: uuid.UUID | None = None,
    stage_config_id: uuid.UUID | None = None,
) -> HRDecisionHistoryResponse:
    """Get complete decision history for a candidate."""
    # Validate candidate exists
    candidate_result = await db.execute(
        select(Candidate).where(Candidate.id == candidate_id)
    )
    candidate = candidate_result.scalar_one_or_none()
    if not candidate:
        raise ValueError(f"Candidate with id {candidate_id} not found")

    # Get all decisions for the candidate
    stmt = select(HrDecision).where(HrDecision.candidate_id == candidate_id)
    
    if job_id:
        # Match decisions explicitly linked to this job OR legacy decisions linked to this candidate's primary job
        stmt = stmt.where(
            or_(
                HrDecision.job_id == job_id,
                and_(
                    HrDecision.job_id.is_(None),
                    candidate.applied_job_id == job_id
                )
            )
        )
    
    if stage_config_id:
        stmt = stmt.where(HrDecision.stage_config_id == stage_config_id)

    decisions_result = await db.execute(
        stmt.order_by(HrDecision.decided_at.desc())
        .options(
            selectinload(HrDecision.user),
            selectinload(HrDecision.stage_config).selectinload(JobStageConfig.template)
        )
    )
    decisions = decisions_result.scalars().all()

    # Group/Deduplicate "Selected for another job" failures to avoid clutter
    final_decisions = []
    auto_reject_seen = False
    
    for d in decisions:
        is_auto_reject = (
            d.decision.lower() == "fail" and 
            d.notes and 
            "Selected for another job" in d.notes
        )
        
        if is_auto_reject:
            if not auto_reject_seen:
                final_decisions.append(d)
                auto_reject_seen = True
            # If we've already seen an auto-reject, skip the others
        else:
            final_decisions.append(d)

    # Count decisions from the filtered list
    pass_count = sum(1 for d in final_decisions if d.decision.lower() == "pass")
    fail_count = sum(1 for d in final_decisions if d.decision.lower() == "fail")
    may_be_count = sum(1 for d in final_decisions if d.decision == "May Be")

    return HRDecisionHistoryResponse(
        candidate_id=candidate_id,
        decisions=[HRDecisionResponse.model_validate(d) for d in final_decisions],
        total_decisions=len(final_decisions),
        pass_count=pass_count,
        fail_count=fail_count,
        may_be_count=may_be_count,
    )


async def update_decision_impl(
    db: AsyncSession,
    decision_id: uuid.UUID,
    decision_data: HRDecisionUpdate,
    user_id: uuid.UUID,
) -> HRDecisionResponse:
    """Update an existing HR decision."""
    # Get existing decision
    decision_result = await db.execute(
        select(HrDecision).where(HrDecision.id == decision_id)
    )
    decision = decision_result.scalar_one_or_none()
    if not decision:
        raise ValueError(f"Decision with id {decision_id} not found")

    actual_job_id = getattr(decision_data, "job_id", None) or decision.job_id

    # Check "May Be" decision limit if updating to "May Be"
    if decision_data.decision == "May Be" and decision.decision != "May Be":
        query = select(func.count(HrDecision.id)).where(
            HrDecision.candidate_id == decision.candidate_id,
            HrDecision.decision == "May Be",
            HrDecision.id != decision_id,  # Exclude current decision
        )
        
        actual_stage_id = getattr(decision_data, "stage_config_id", None) or decision.stage_config_id
        
        if actual_stage_id:
            query = query.where(HrDecision.stage_config_id == actual_stage_id)
        elif actual_job_id:
            query = query.where(HrDecision.job_id == actual_job_id)

        existing_may_be = await db.execute(query)
        may_be_count = existing_may_be.scalar() or 0

        if may_be_count >= 1:
            raise ValueError(
                "Only one 'May Be' decision is allowed per candidate per stage."
            )
            
    # Check "pass" decision limit (only 1 per candidate per stage for THIS job)
    if (
        decision_data.decision.lower() == "pass"
        and decision.decision.lower() != "pass"
        and actual_job_id
    ):
        query = select(func.count(HrDecision.id)).where(
            HrDecision.candidate_id == decision.candidate_id,
            HrDecision.job_id == actual_job_id,
            func.lower(HrDecision.decision) == "pass",
            HrDecision.id != decision_id,
        )
        
        actual_stage_id = getattr(decision_data, "stage_config_id", None) or decision.stage_config_id
        if actual_stage_id:
            query = query.where(HrDecision.stage_config_id == actual_stage_id)

        existing_approve = await db.execute(query)
        approve_count = existing_approve.scalar() or 0

        if approve_count >= 1:
            stage_msg = f" for stage {actual_stage_id}" if actual_stage_id else ""
            raise ValueError(
                f"This candidate has already passed for this job{stage_msg}. "
            )

    # Update decision
    was_final_decision = decision.decision.lower() in ["pass", "fail"]
    old_decision = decision.decision.lower()
    
    decision.decision = decision_data.decision
    decision.notes = decision_data.notes
    decision.score = decision_data.score
    if getattr(decision_data, "job_id", None):
        decision.job_id = decision_data.job_id
    if getattr(decision_data, "stage_config_id", None):
        decision.stage_config_id = decision_data.stage_config_id

    await db.commit()
    await db.refresh(decision)

    logger.info(
        f"Updated HR decision {decision_id} to {decision_data.decision} "
        f"by user {user_id}"
    )

    # Handle auto-failure from other jobs if this one is now passed
    if decision_data.decision.lower() == "pass" and old_decision != "pass" and actual_job_id:
        await handle_multi_job_auto_failure_impl(db, decision.candidate_id, actual_job_id, user_id)

    # Trigger stage advancement in the pipeline if it hasn't happened yet
    # (transitioning from 'May Be' or None to 'pass'/'fail')
    if decision_data.decision.lower() in ["pass", "fail"] and not was_final_decision:
        cs_stmt = select(CandidateStage).where(CandidateStage.candidate_id == decision.candidate_id)
        if decision.stage_config_id:
            cs_stmt = cs_stmt.options(selectinload(CandidateStage.job_stage)).where(CandidateStage.job_stage_id == decision.stage_config_id)
        else:
            cs_stmt = (
                cs_stmt.join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
                .options(selectinload(CandidateStage.job_stage))
                .where(JobStageConfig.job_id == actual_job_id)
                .where(CandidateStage.status == "active")
            )
        
        cs_res = await db.execute(cs_stmt)
        cs_to_advance = cs_res.scalar_one_or_none()

        if cs_to_advance:
            success = decision_data.decision.lower() == "pass"
            is_resume_screening_decision = (decision.stage_config_id is None)
            is_stage_zero = False
            if cs_to_advance.job_stage and cs_to_advance.job_stage.stage_order == 1:
                is_stage_zero = True

            if is_resume_screening_decision and not is_stage_zero:
                # If this is a Resume Screening decision and the candidate stage is not Stage 0 (e.g. Stage 1 - HR Round):
                # - If passed: ensure the stage is active, do not mark completed.
                # - If failed: mark the stage as failed.
                if not success:
                    await candidate_stage_service.advance_candidate(db, decision.candidate_id, cs_to_advance.id, success=False)
                    await db.commit()
            else:
                await candidate_stage_service.advance_candidate(db, decision.candidate_id, cs_to_advance.id, success=success)
                await db.commit()

    # Trigger cross-match in background if candidate is now failed and wasn't before
    if decision_data.decision.lower() == "fail" and old_decision != "fail":
        # We need the candidate model with resumes loaded
        candidate_result = await db.execute(
            select(Candidate)
            .options(selectinload(Candidate.resumes))
            .where(Candidate.id == decision.candidate_id)
        )
        candidate_to_cross_match = candidate_result.scalar_one_or_none()
        if candidate_to_cross_match:
            logger.info(f"Transitioned to 'fail'. Triggering automatic cross-job discovery for candidate {decision.candidate_id} from job context {actual_job_id}.")
            trigger_cross_match_for_candidate_impl(candidate_to_cross_match, job_id=actual_job_id)

    await db.commit()
    
    # Reload with relationships for the response
    final_stmt = select(HrDecision).where(HrDecision.id == decision_id).options(
        selectinload(HrDecision.user),
        selectinload(HrDecision.stage_config).selectinload(JobStageConfig.template)
    )
    final_res = await db.execute(final_stmt)
    decision_final = final_res.scalar_one()

    # Invalidate cache for the job
    if actual_job_id:
        await system_service.invalidate_job_cache(actual_job_id)

    return HRDecisionResponse.model_validate(decision_final)
