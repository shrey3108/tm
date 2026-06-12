import uuid
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.models.hr_decisions import HrDecision
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.job_stage_configs import JobStageConfig
from app.v1.db.models.cross_job_matches import CrossJobMatch
from app.v1.core.logging import get_logger
from app.v1.services.candidate_stage_service import candidate_stage_service

logger = get_logger(__name__)


def trigger_cross_match_for_candidate_impl(candidate: Candidate, job_id: uuid.UUID | None = None) -> None:
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


async def handle_multi_job_auto_failure_impl(
    db: AsyncSession,
    candidate_id: uuid.UUID,
    passed_job_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    """Automatically fail a candidate from all other jobs once passed/approved for one."""
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


async def handle_email_based_global_failure_impl(
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
