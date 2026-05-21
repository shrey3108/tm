"""
HR Decision Service - Handles business logic for HR decisions.
"""

import uuid
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.v1.db.models.hr_decisions import HrDecision
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.resumes import Resume
from app.v1.db.models.cross_job_matches import CrossJobMatch
from app.v1.schemas.hr_decision import (
    HRDecisionCreate,
    HRDecisionResponse,
    HRDecisionHistoryResponse,
    HRDecisionUpdate,
)
from app.v1.core.logging import get_logger
from sqlalchemy import or_, and_, Text, case
from sqlalchemy.dialects.postgresql import UUID
from app.v1.services.candidate_stage_service import candidate_stage_service
from app.v1.services.admin.system_service import system_service

logger = get_logger(__name__)


def _trigger_cross_match_for_candidate(candidate: Candidate, job_id: uuid.UUID | None = None) -> None:
    """Fire-and-forget Celery cross-match task for a rejected candidate.

    Picks the candidate's latest resume and triggers discovery across all jobs
    except the one they were just rejected from.
    """
    try:
        from app.v1.services.resume_upload.background import BackgroundProcessor
        from app.v1.services.resume_upload.processor import ResumeProcessor

        # Use the provided job_id (rejection context) or fallback to their original application
        origin_job_id = job_id or candidate.applied_job_id

        resumes = getattr(candidate, "resumes", None) or []
        if not resumes:
            logger.info(
                "cross_match skipped: no resumes found for candidate_id=%s",
                candidate.id,
            )
            return

        # Pick the most recently uploaded resume
        latest_resume = max(resumes, key=lambda r: r.uploaded_at)

        # Use BackgroundProcessor for standard task scheduling
        bg_processor = BackgroundProcessor(ResumeProcessor())
        bg_processor.schedule_cross_match(
            resume_id=latest_resume.id, original_job_id=origin_job_id
        )

        logger.info(
            "Automatic cross-match triggered for candidate_id=%s, resume_id=%s, context_job_id=%s",
            candidate.id,
            latest_resume.id,
            origin_job_id,
        )
    except Exception:
        logger.exception(
            "Failed to queue automatic cross-match task for candidate_id=%s",
            candidate.id,
        )


class HRDecisionService:
    """Service for managing HR decisions with business logic validation."""

    async def create_decision(
        self,
        db: AsyncSession,
        candidate_id: uuid.UUID,
        decision_data: HRDecisionCreate,
        user_id: uuid.UUID,
        stage_config_id: uuid.UUID | None = None,
    ) -> HRDecisionResponse:
        """Create a new HR decision with validation.
        
        Note: If stage_config_id is actually a CandidateStage.id, it will be automatically
        resolved to the correct JobStageConfig.id.
        """
        
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
            from app.v1.db.models.candidate_stages import CandidateStage
            cs_check = await db.get(CandidateStage, stage_config_id)
            if cs_check and cs_check.job_stage_id:
                stage_config_id = cs_check.job_stage_id
        else:
            # If no stage_config_id is provided, try to default to the Resume Screening stage (Order 0)
            from app.v1.db.models.job_stage_configs import JobStageConfig
            if actual_job_id:
                from app.v1.db.models.stage_templates import StageTemplate
                stage_zero_stmt = (
                    select(JobStageConfig.id)
                    .join(StageTemplate, JobStageConfig.template_id == StageTemplate.id)
                    .where(JobStageConfig.job_id == actual_job_id)
                    .where(
                        or_(
                            JobStageConfig.stage_order == 0,
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
            await self._handle_email_based_global_failure(db, candidate.email, actual_job_id, user_id)

        
        # Trigger stage advancement in the pipeline
        if decision_data.decision.lower() in ["pass", "fail"]:
            from app.v1.db.models.candidate_stages import CandidateStage
            from app.v1.db.models.job_stage_configs import JobStageConfig

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
                if cs_to_advance.job_stage and cs_to_advance.job_stage.stage_order == 0:
                    is_stage_zero = True

                if is_resume_screening_decision and not is_stage_zero:
                    # If this is a Resume Screening decision and the candidate stage is not Stage 0 (e.g. Stage 1 - HR Round):
                    # - If passed: ensure the stage is active, do not mark completed.
                    # - If failed: mark the stage as failed.
                    if success:
                        if cs_to_advance.status == "pending":
                            cs_to_advance.status = "active"
                            from datetime import datetime
                            cs_to_advance.started_at = datetime.utcnow()
                            
                            from app.v1.db.models.stage_templates import StageTemplate
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
                        from app.v1.services.candidate_stage_service import candidate_stage_service
                        await candidate_stage_service.advance_candidate(db, candidate_id, cs_to_advance.id, success=False)
                        await db.commit()
                else:
                    # NEW TWO-STEP LOGIC:
                    # If it's an interview stage (Order > 0) and it's pending, just make it active.
                    # BUT if it's Stage 0 (Resume Screening), ALWAYS advance immediately.
                    if success and cs_to_advance.status == "pending" and not is_stage_zero:
                        # Step 1: Resume Approval -> Make the stage "active" for interview
                        cs_to_advance.status = "active"
                        from datetime import datetime
                        cs_to_advance.started_at = datetime.utcnow()
                        
                        # Ensure candidate status reflects "Active"
                        from app.v1.db.models.stage_templates import StageTemplate
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
                        # Step 2: Interview Approval (or Rejection) OR Stage 0 Approval -> Advance to next stage
                        from app.v1.services.candidate_stage_service import candidate_stage_service
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
                    from app.v1.services.candidate_stage_service import candidate_stage_service
                    await candidate_stage_service.initiate_candidate_pipeline(db, candidate_id, actual_job_id)
                    
                    # NEW: Since Resume Screening is now Stage 0, approving it should COMPLETE it 
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
                _trigger_cross_match_for_candidate(candidate, job_id=actual_job_id)

        # FINAL COMMIT: Save everything (decision + advancement) together
        await db.commit()
        
        # Reload with relationships for the response
        from app.v1.db.models.job_stage_configs import JobStageConfig
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

    async def get_decision_history(
        self,
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

        from app.v1.db.models.job_stage_configs import JobStageConfig
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

    async def update_decision(
        self,
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

        # NEW: Handle auto-failure from other jobs if this one is now passed
        if decision_data.decision.lower() == "pass" and old_decision != "pass" and actual_job_id:
            await self._handle_multi_job_auto_failure(db, decision.candidate_id, actual_job_id, user_id)

        # Trigger stage advancement in the pipeline if it hasn't happened yet
        # (transitioning from 'May Be' or None to 'pass'/'fail')
        if decision_data.decision.lower() in ["pass", "fail"] and not was_final_decision:
            from app.v1.db.models.candidate_stages import CandidateStage
            from app.v1.db.models.job_stage_configs import JobStageConfig

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
                if cs_to_advance.job_stage and cs_to_advance.job_stage.stage_order == 0:
                    is_stage_zero = True

                if is_resume_screening_decision and not is_stage_zero:
                    # If this is a Resume Screening decision and the candidate stage is not Stage 0 (e.g. Stage 1 - HR Round):
                    # - If passed: ensure the stage is active, do not mark completed.
                    # - If failed: mark the stage as failed.
                    if success:
                        if cs_to_advance.status == "pending":
                            cs_to_advance.status = "active"
                            from datetime import datetime
                            cs_to_advance.started_at = datetime.utcnow()
                            
                            from app.v1.db.models.stage_templates import StageTemplate
                            st_stmt = (
                                select(StageTemplate.name)
                                .select_from(JobStageConfig)
                                .join(StageTemplate, JobStageConfig.template_id == StageTemplate.id)
                                .where(JobStageConfig.id == cs_to_advance.job_stage_id)
                            )
                            st_name = (await db.execute(st_stmt)).scalar()
                            
                            candidate_to_update = await db.get(Candidate, decision.candidate_id)
                            if candidate_to_update and st_name:
                                 candidate_to_update.current_status = f"{st_name} (Active)"
                        await db.commit()
                    else:
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
                _trigger_cross_match_for_candidate(candidate_to_cross_match, job_id=actual_job_id)

        await db.commit()
        
        # Reload with relationships for the response
        from app.v1.db.models.job_stage_configs import JobStageConfig
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

    async def get_decision_summary(
        self,
        db: AsyncSession,
    ) -> "HRDecisionSummary":
        """Get global summary: how many candidates are in each decision bucket."""
        from app.v1.db.models.candidates import Candidate
        from app.v1.schemas.hr_decision import HRDecisionSummary

        # Total unique candidates in DB (by email, fallback to ID if email is null)
        total_result = await db.execute(
            select(func.count(func.distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text)))))
        )
        total_candidates = total_result.scalar() or 0

        # Counts per decision status (one latest decision per candidate)
        # We group by candidate_id and pick their latest decision
        subq = (
            select(
                HrDecision.candidate_id,
                HrDecision.decision,
                func.row_number()
                .over(
                    partition_by=func.coalesce(HrDecision.candidate_id, func.cast(HrDecision.id, UUID)),
                    order_by=(
                        case((func.lower(HrDecision.decision) == "pass", 0), (HrDecision.decision == "May Be", 1), else_=2),
                        HrDecision.decided_at.desc()
                    ),
                )
                .label("rn"),
            )
        ).subquery()

        latest_decisions = await db.execute(
            select(subq.c.decision, func.count().label("cnt"))
            .where(subq.c.rn == 1)
            .group_by(subq.c.decision)
        )
        rows = latest_decisions.fetchall()

        counts = {row.decision: row.cnt for row in rows}
        decided_total = sum(counts.values())

        return HRDecisionSummary(
            total_candidates=total_candidates,
            passed_count=counts.get("pass", 0),
            failed_count=counts.get("fail", 0),
            maybe_count=counts.get("May Be", 0),
            undecided_count=max(total_candidates - decided_total, 0),
        )

    async def get_job_decision_summary(
        self,
        db: AsyncSession,
        job_id: uuid.UUID,
    ) -> "HRJobDecisionSummary":
        """Get decision summary scoped to candidates of a specific job (including cross-matches)."""
        from app.v1.db.models.candidates import Candidate
        from app.v1.db.models.cross_job_matches import CrossJobMatch
        from app.v1.schemas.hr_decision import HRJobDecisionSummary

        # 1. Get unique candidate emails currently linked to this job (Native OR Cross)
        native_subq = select(Candidate.email).where(Candidate.applied_job_id == job_id)
        cross_subq = (
            select(Candidate.email)
            .join(CrossJobMatch, Candidate.id == CrossJobMatch.candidate_id)
            .where(CrossJobMatch.matched_job_id == job_id)
        )
        
        # Combine and deduplicate
        combined_emails_stmt = select(func.count(func.distinct(func.coalesce(native_subq.subquery().c.email, cross_subq.subquery().c.email))))
        # Note: A simpler way to get count of unique individuals in this job:
        total_candidates_stmt = select(
            func.count(func.distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text))))
        ).where(
            or_(
                Candidate.applied_job_id == job_id,
                Candidate.id.in_(
                    select(CrossJobMatch.candidate_id).where(CrossJobMatch.matched_job_id == job_id)
                )
            )
        )
        total_candidates = await db.scalar(total_candidates_stmt) or 0

        # Latest decision per candidate, filtered to decisions explicitly made for this job
        subq = (
            select(
                HrDecision.candidate_id,
                HrDecision.decision,
                func.row_number()
                .over(
                    partition_by=HrDecision.candidate_id,
                    order_by=HrDecision.decided_at.desc(),
                )
                .label("rn"),
            ).where(
                or_(
                    HrDecision.job_id == job_id,
                    # Fallback for old records that belong to natively applied candidates
                    and_(
                        HrDecision.job_id.is_(None),
                        HrDecision.candidate_id.in_(
                            select(Candidate.id).where(
                                Candidate.applied_job_id == job_id
                            )
                        ),
                    ),
                )
            )
        ).subquery()

        latest_decisions = await db.execute(
            select(subq.c.decision, func.count().label("cnt"))
            .where(subq.c.rn == 1)
            .group_by(subq.c.decision)
        )
        rows = latest_decisions.fetchall()

        counts = {row.decision: row.cnt for row in rows}
        decided_total = sum(counts.values())

        return HRJobDecisionSummary(
            job_id=job_id,
            total_candidates=total_candidates,
            passed_count=counts.get("pass", 0),
            failed_count=counts.get("fail", 0),
            maybe_count=counts.get("May Be", 0),
            undecided_count=max(total_candidates - decided_total, 0),
        )

    async def get_job_screening_summary(
        self,
        db: AsyncSession,
        job_id: uuid.UUID,
    ) -> dict[str, int]:
        """Count resumes for a job grouped by pass_fail status, including dynamic cross-matches."""
        from app.v1.db.models.cross_job_matches import CrossJobMatch
        from app.v1.db.models.jobs import Job
        from sqlalchemy import or_, and_

        # 1. Native Resumes - Get unique per-job individuals
        native_subq = (
            select(
                func.coalesce(Candidate.email, func.cast(Candidate.id, Text)).label("unique_id"),
                Resume.pass_fail
            )
            .join(Resume, Resume.candidate_id == Candidate.id)
            .where(Candidate.applied_job_id == job_id)
            .distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text)))
            .order_by(func.coalesce(Candidate.email, func.cast(Candidate.id, Text)), Resume.uploaded_at.desc())
            .subquery()
        )
        
        # 2. Cross-matches - Get unique per-job individuals
        cross_subq = (
            select(
                func.coalesce(Candidate.email, func.cast(Candidate.id, Text)).label("unique_id"),
                CrossJobMatch.match_score
            )
            .join(CrossJobMatch, CrossJobMatch.candidate_id == Candidate.id)
            .where(CrossJobMatch.matched_job_id == job_id)
            .distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text)))
            .order_by(func.coalesce(Candidate.email, func.cast(Candidate.id, Text)), CrossJobMatch.created_at.desc())
            .subquery()
        )

        from app.v1.db.models.jobs import Job
        job = await db.get(Job, job_id)
        threshold = float(job.passing_threshold) if job and job.passing_threshold else 70.0

        # Combine results: prioritization (Native > Cross)
        # We'll fetch all and deduplicate in Python for simplicity and precision in this specific helper
        native_res = await db.execute(select(native_subq.c.unique_id, native_subq.c.pass_fail))
        cross_res = await db.execute(select(cross_subq.c.unique_id, cross_subq.c.match_score))
        
        counts = {"passed": 0, "failed": 0, "pending": 0}
        processed_ids = set()
        
        for uid, pf in native_res.all():
            processed_ids.add(uid)
            counts[pf if pf in counts else "pending"] += 1
            
        for uid, score in cross_res.all():
            if uid in processed_ids:
                continue
            
            s = float(score) if score is not None else 0.0
            pf = "passed" if s >= threshold else "failed"
            counts[pf] += 1

        return {
            "job_id": job_id,
            "passed_count": counts["passed"],
            "failed_count": counts["failed"],
            "pending_count": counts["pending"],
        }

    async def get_global_screening_summary(
        self,
        db: AsyncSession,
    ) -> dict[str, int]:
        """Global unique candidate screening status summary."""
        from app.v1.db.models.cross_job_matches import CrossJobMatch
        from app.v1.db.models.jobs import Job
        from app.v1.db.models.candidates import Candidate

        # Subquery to get unique candidate identifiers (email) and their strongest source of screening info
        # Prioritize native (resumes) over cross matches across ALL jobs
        # Note: We use a simplified logic here: if they passed ANY job natively, they are 'passed'. 
        # If they failed all native but passed a cross match, they are 'passed'.
        
        # 1. Native status per unique person
        native_stmt = (
            select(
                func.coalesce(Candidate.email, func.cast(Candidate.id, Text)).label("unique_id"),
                Resume.pass_fail
            )
            .join(Resume, Resume.candidate_id == Candidate.id)
            .distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text)))
            .order_by(
                func.coalesce(Candidate.email, func.cast(Candidate.id, Text)),
                case((Resume.pass_fail == "passed", 0), (Resume.pass_fail == "pending", 1), else_=2)
            )
        )
        
        # 2. Cross-match status per unique person
        # (Using a standard 70.0 threshold for global cross-match counting simplicity)
        cross_stmt = (
            select(
                func.coalesce(Candidate.email, func.cast(Candidate.id, Text)).label("unique_id"),
                case((CrossJobMatch.match_score >= 70.0, "passed"), else_="failed").label("pass_fail")
            )
            .join(CrossJobMatch, CrossJobMatch.candidate_id == Candidate.id)
            .distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text)))
            .order_by(
                func.coalesce(Candidate.email, func.cast(Candidate.id, Text)),
                case((CrossJobMatch.match_score >= 70.0, 0), else_=1)
            )
        )

        native_res = await db.execute(native_stmt)
        cross_res = await db.execute(cross_stmt)
        
        counts = {"passed": 0, "failed": 0, "pending": 0}
        processed_ids = set()
        
        for uid, pf in native_res.all():
            processed_ids.add(uid)
            counts[pf if pf in counts else "pending"] += 1
            
        for uid, pf in cross_res.all():
            if uid in processed_ids:
                continue
            counts[pf] += 1

        return {
            "passed": counts["passed"],
            "failed": counts["failed"],
            "pending": counts["pending"],
        }

    async def get_global_decision_summary(self, db: AsyncSession) -> dict[str, int]:
        """Global count of latest decisions for all candidates."""
        summary = await self.get_decision_summary(db)
        return {
            "total_candidates": summary.total_candidates,
            "passed_count": summary.passed_count,
            "failed_count": summary.failed_count,
            "maybe_count": summary.maybe_count,
            "undecided_count": summary.undecided_count,
        }

    async def _handle_multi_job_auto_failure(
        self,
        db: AsyncSession,
        candidate_id: uuid.UUID,
        passed_job_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        """Automatically fail a candidate from all other jobs once passed/approved for one."""
        from app.v1.db.models.candidate_stages import CandidateStage
        from app.v1.db.models.job_stage_configs import JobStageConfig
        from app.v1.db.models.cross_job_matches import CrossJobMatch
        
        # 1. Get all other job IDs where this candidate is active or has a match
        candidate_stmt = select(Candidate).where(Candidate.id == candidate_id)
        candidate_res = await db.execute(candidate_stmt)
        candidate = candidate_res.scalar_one_or_none()
        if not candidate:
            return

        other_job_ids = set()
        if candidate.applied_job_id and candidate.applied_job_id != passed_job_id:
            other_job_ids.add(candidate.applied_job_id)
            
        cross_res = await db.execute(
            select(CrossJobMatch.matched_job_id).where(CrossJobMatch.candidate_id == candidate_id)
        )
        for row in cross_res.all():
            if row[0] != passed_job_id:
                other_job_ids.add(row[0])
                
        if not other_job_ids:
            return

        note = "Auto-failed because the candidate was accepted for another job."

        for job_id in other_job_ids:
            # Check if already failed for this job (avoid duplicate failures)
            latest_dec_stmt = (
                select(HrDecision)
                .where(HrDecision.candidate_id == candidate_id, HrDecision.job_id == job_id)
                .order_by(HrDecision.decided_at.desc())
                .limit(1)
            )
            latest_dec_res = await db.execute(latest_dec_stmt)
            latest_dec = latest_dec_res.scalar_one_or_none()
            
            if latest_dec and latest_dec.decision.lower() == "fail":
                continue
                
            # Create auto-failure record
            auto_reject = HrDecision(
                candidate_id=candidate_id,
                job_id=job_id,
                user_id=user_id,
                decision="fail",
                notes=note
            )
            db.add(auto_reject)

            # Advance/Fail candidate stage for this job if there is an active one
            cs_stmt = (
                select(CandidateStage)
                .select_from(CandidateStage)
                .join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
                .where(
                    CandidateStage.candidate_id == candidate_id,
                    JobStageConfig.job_id == job_id,
                    CandidateStage.status == "active"
                )
            )
            cs_res = await db.execute(cs_stmt)
            cs_to_fail = cs_res.scalar_one_or_none()
            
            if cs_to_fail:
                await candidate_stage_service.advance_candidate(db, candidate_id, cs_to_fail.id, success=False)
        
        # Flush changes to DB
        await db.flush()


    async def _handle_email_based_global_failure(
        self,
        db: AsyncSession,
        email: str | None,
        passed_job_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        """Fail all candidate records associated with an email from all other jobs."""
        if not email:
            return

        try:
            # 1. Find all candidate IDs associated with this email
            all_ids_stmt = select(Candidate.id).where(Candidate.email == email)
            all_ids_res = await db.execute(all_ids_stmt)
            all_candidate_ids = [row[0] for row in all_ids_res.all()]

            # 2. Find all unique jobs these IDs are linked to (Native or Cross-match)
            all_linked_jobs = set()
            for cid in all_candidate_ids:
                c_stmt = select(Candidate.applied_job_id).where(Candidate.id == cid)
                ajid = (await db.execute(c_stmt)).scalar()
                if ajid:
                    all_linked_jobs.add(ajid)
                
                xm_res = await db.execute(
                    select(CrossJobMatch.matched_job_id)
                    .where(CrossJobMatch.candidate_id == cid)
                )
                for row in xm_res.all():
                    if row[0]:
                        all_linked_jobs.add(row[0])
            
            # 3. Remove the current job (the one we just approved)
            all_linked_jobs.discard(passed_job_id)

            if all_linked_jobs:
                for other_job_id in all_linked_jobs:
                    for cid in all_candidate_ids:
                        # Check if there's already a decision
                        check_stmt = select(HrDecision.id).where(
                            HrDecision.candidate_id == cid,
                            HrDecision.job_id == other_job_id
                        ).limit(1)
                        if (await db.execute(check_stmt)).scalar():
                            continue

                        # Add auto-fail
                        auto_reject = HrDecision(
                            candidate_id=cid,
                            job_id=other_job_id,
                            user_id=user_id,
                            decision="fail",
                            notes="Selected for another job"
                        )
                        db.add(auto_reject)
                
                await db.commit()
                logger.info(f"Global auto-fail for email {email}: Failed from {len(all_linked_jobs)} other jobs.")
        except Exception as e:
            logger.error(f"Failed to global auto-fail candidate {email}: {e}")


# Create service instance
hr_decision_service = HRDecisionService()

