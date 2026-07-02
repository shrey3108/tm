import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.session import get_db
from app.v1.dependencies import check_permission
from app.v1.db.models.candidate_test_paper import CandidateTestPaper
from app.v1.db.models.candidate_test_paper_history import CandidateTestPaperHistory
from app.v1.db.models.candidates import Candidate
from app.v1.schemas.task_papers import (
    CandidateTestPaperEmailSend,
    CandidateTestPaperBulkEmailSend,
    CandidateTestPaperHistoryRead,
)
from app.v1.schemas.user import UserRead
from app.v1.services.email_service import send_candidate_task_email_via_smtp
from app.v1.routes.task_papers_helpers import get_candidate_active_job_id, get_candidate_active_stage_config_id

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/assigned/{candidate_id}/history", response_model=list[CandidateTestPaperHistoryRead])
async def get_candidate_test_paper_history(
    candidate_id: uuid.UUID,
    job_stage_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
):
    """Retrieve the assignment and email log history for the candidate."""
    active_stage_id = job_stage_id or await get_candidate_active_stage_config_id(db, candidate_id)
    stmt = (
        select(CandidateTestPaperHistory)
        .where(CandidateTestPaperHistory.candidate_id == candidate_id)
    )
    if active_stage_id:
        stmt_stage = stmt.where(CandidateTestPaperHistory.job_stage_config_id == active_stage_id).order_by(CandidateTestPaperHistory.assigned_at.desc())
        res = await db.execute(stmt_stage)
        history_records = res.scalars().all()
        if not history_records:
            stmt_none = stmt.where(CandidateTestPaperHistory.job_stage_config_id.is_(None)).order_by(CandidateTestPaperHistory.assigned_at.desc())
            res = await db.execute(stmt_none)
            history_records = res.scalars().all()
    else:
        stmt = stmt.where(CandidateTestPaperHistory.job_stage_config_id.is_(None)).order_by(CandidateTestPaperHistory.assigned_at.desc())
        res = await db.execute(stmt)
        history_records = res.scalars().all()
        
    return history_records


@router.get("/assigned/job/{job_id}/history", response_model=list[CandidateTestPaperHistoryRead])
async def get_job_test_paper_history(
    job_id: uuid.UUID,
    job_stage_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
):
    """Retrieve the assignment and email log history for all candidates under a specific job."""
    from app.v1.routes.task_papers_helpers import get_job_first_question_stage_config_id
    resolved_stage_id = job_stage_id or await get_job_first_question_stage_config_id(db, job_id)
    stmt = (
        select(CandidateTestPaperHistory)
        .where(CandidateTestPaperHistory.job_id == job_id)
    )
    if resolved_stage_id:
        stmt_stage = stmt.where(CandidateTestPaperHistory.job_stage_config_id == resolved_stage_id).order_by(CandidateTestPaperHistory.assigned_at.desc())
        res = await db.execute(stmt_stage)
        history_records = res.scalars().all()
        if not history_records:
            stmt_none = stmt.where(CandidateTestPaperHistory.job_stage_config_id.is_(None)).order_by(CandidateTestPaperHistory.assigned_at.desc())
            res = await db.execute(stmt_none)
            history_records = res.scalars().all()
    else:
        stmt = stmt.where(CandidateTestPaperHistory.job_stage_config_id.is_(None)).order_by(CandidateTestPaperHistory.assigned_at.desc())
        res = await db.execute(stmt)
        history_records = res.scalars().all()
        
    return history_records


@router.post("/send-email", status_code=status.HTTP_200_OK)
async def send_test_paper_email(
    email_data: CandidateTestPaperEmailSend,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:decide")),
):
    """Trigger sending/notifying the candidate of their assigned test paper via email."""
    # Find Candidate by email
    stmt = select(Candidate).where(func.lower(Candidate.email) == email_data.candidate_email.lower())
    res = await db.execute(stmt)
    candidate = res.scalar_one_or_none()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate with email {email_data.candidate_email} not found.",
        )

    # Verify if the specific CandidateTestPaper exists and belongs to the candidate
    paper = await db.get(CandidateTestPaper, email_data.paper_id)
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CandidateTestPaper with ID {email_data.paper_id} not found.",
        )
    if paper.candidate_id != candidate.id:
        job_id = await get_candidate_active_job_id(db, candidate)
        if not (paper.candidate_id is None and paper.job_id == job_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The specified test paper does not belong to this candidate.",
            )

    # Clone/lock job-level paper for this candidate
    if paper.candidate_id is None:
        stmt_existing = select(CandidateTestPaper).where(
            CandidateTestPaper.candidate_id == candidate.id,
            CandidateTestPaper.job_id == paper.job_id
        )
        if paper.job_stage_config_id:
            stmt_existing = stmt_existing.where(CandidateTestPaper.job_stage_config_id == paper.job_stage_config_id)
        else:
            stmt_existing = stmt_existing.where(CandidateTestPaper.job_stage_config_id.is_(None))
        res_existing = await db.execute(stmt_existing)
        existing_paper = res_existing.scalars().first()
        if existing_paper:
            if existing_paper.email_sent_count > 0 and not email_data.force:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email has already been sent to this candidate. Are you sure you want to send it again?",
                )
            existing_paper.name = paper.name
            existing_paper.questions = paper.questions
            existing_paper.mcqs = paper.mcqs
            existing_paper.project_task = paper.project_task
            existing_paper.task_file_path = paper.task_file_path
            existing_paper.task_skills = paper.task_skills
            existing_paper.job_stage_config_id = paper.job_stage_config_id
            existing_paper.guideline_id = paper.guideline_id
            existing_paper.guideline_content = paper.guideline_content
            paper = existing_paper
        else:
            paper = CandidateTestPaper(
                candidate_id=candidate.id,
                job_id=paper.job_id,
                position_id=paper.position_id,
                job_stage_config_id=paper.job_stage_config_id,
                name=paper.name,
                questions=paper.questions,
                mcqs=paper.mcqs,
                project_task=paper.project_task,
                task_file_path=paper.task_file_path,
                task_skills=paper.task_skills,
                guideline_id=paper.guideline_id,
                guideline_content=paper.guideline_content,
                email_sent_count=0
            )
            db.add(paper)
            await db.flush()
    else:
        if paper.email_sent_count > 0 and not email_data.force:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email has already been sent to this candidate. Are you sure you want to send it again?",
            )

    # Log this assignment/email in CandidateTestPaperHistory
    history_entry = CandidateTestPaperHistory(
        candidate_id=candidate.id,
        job_id=paper.job_id,
        job_stage_config_id=paper.job_stage_config_id,
        name=paper.name,
        questions=paper.questions,
        mcqs=paper.mcqs,
        project_task=paper.project_task,
        task_file_path=paper.task_file_path,
        task_skills=paper.task_skills,
        user_id=user.id,
        guideline_id=paper.guideline_id,
        guideline_content=paper.guideline_content,
    )
    db.add(history_entry)

    try:
        await send_candidate_task_email_via_smtp(candidate, paper, db)
    except Exception as e:
        logger.exception(f"SMTP error in send_test_paper_email: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send email via SMTP: {str(e)}",
        )

    # Increment email sent count
    paper.email_sent_count += 1
    candidate.email_sent_count += 1
    db.add(paper)
    db.add(candidate)
    await db.commit()

    from app.v1.core.config import settings
    target_email = settings.SMTP_TARGET_EMAIL_OVERRIDE
    if not target_email:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SMTP_TARGET_EMAIL_OVERRIDE is not configured in .env. Cannot send emails.",
        )

    message = f"Assigned test paper email successfully sent to {target_email} (intended for: {candidate.email})."

    return {
        "status": "success",
        "message": message,
    }


@router.post("/send-email/bulk", status_code=status.HTTP_200_OK)
async def send_bulk_test_paper_email(
    email_data: CandidateTestPaperBulkEmailSend,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:decide")),
):
    """Trigger sending/notifying multiple candidates of their assigned test paper via email in bulk."""
    # 1. Fetch the paper
    paper = await db.get(CandidateTestPaper, email_data.paper_id)
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CandidateTestPaper with ID {email_data.paper_id} not found.",
        )

    if not email_data.candidate_ids and not email_data.candidate_emails:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either candidate_ids or candidate_emails must be provided.",
        )

    # 2. Fetch candidates
    candidates = []
    if email_data.candidate_ids:
        stmt = select(Candidate).where(Candidate.id.in_(email_data.candidate_ids))
        res = await db.execute(stmt)
        candidates.extend(res.scalars().all())

    if email_data.candidate_emails:
        lower_emails = [e.lower() for e in email_data.candidate_emails]
        stmt = select(Candidate).where(func.lower(Candidate.email).in_(lower_emails))
        res = await db.execute(stmt)
        existing_ids = {c.id for c in candidates}
        for cand in res.scalars().all():
            if cand.id not in existing_ids:
                candidates.append(cand)

    # Verify we resolved at least some candidates
    if not candidates:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No matching candidates found.",
        )

    # 3. Validate paper ownership for each candidate
    for candidate in candidates:
        if paper.candidate_id != candidate.id:
            job_id = await get_candidate_active_job_id(db, candidate)
            if not (paper.candidate_id is None and paper.job_id == job_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"The specified test paper does not belong to candidate {candidate.email}.",
                )

    if paper.email_sent_count > 0 and not email_data.force:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email has already been sent to one or more of these candidates. Are you sure you want to send it again?",
        )

    # 4. Send email logic for each candidate
    sent_emails = []
    failed_emails = []
    for candidate in candidates:
        try:
            current_paper = paper
            if paper.candidate_id is None:
                stmt_existing = select(CandidateTestPaper).where(
                    CandidateTestPaper.candidate_id == candidate.id,
                    CandidateTestPaper.job_id == paper.job_id
                )
                if paper.job_stage_config_id:
                    stmt_existing = stmt_existing.where(CandidateTestPaper.job_stage_config_id == paper.job_stage_config_id)
                else:
                    stmt_existing = stmt_existing.where(CandidateTestPaper.job_stage_config_id.is_(None))
                res_existing = await db.execute(stmt_existing)
                existing_paper = res_existing.scalars().first()
                if existing_paper:
                    if existing_paper.email_sent_count > 0 and not email_data.force:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail=f"Email has already been sent to candidate {candidate.email}. Are you sure you want to send it again?",
                        )
                    existing_paper.name = paper.name
                    existing_paper.questions = paper.questions
                    existing_paper.mcqs = paper.mcqs
                    existing_paper.project_task = paper.project_task
                    existing_paper.task_file_path = paper.task_file_path
                    existing_paper.task_skills = paper.task_skills
                    existing_paper.job_stage_config_id = paper.job_stage_config_id
                    existing_paper.guideline_id = paper.guideline_id
                    existing_paper.guideline_content = paper.guideline_content
                    current_paper = existing_paper
                else:
                    # Create a cloned candidate-specific test paper
                    current_paper = CandidateTestPaper(
                        candidate_id=candidate.id,
                        job_id=paper.job_id,
                        position_id=paper.position_id,
                        job_stage_config_id=paper.job_stage_config_id,
                        name=paper.name,
                        questions=paper.questions,
                        mcqs=paper.mcqs,
                        project_task=paper.project_task,
                        task_file_path=paper.task_file_path,
                        task_skills=paper.task_skills,
                        guideline_id=paper.guideline_id,
                        guideline_content=paper.guideline_content,
                        email_sent_count=0
                    )
                    db.add(current_paper)
                    await db.flush()

            # Record in history
            history_entry = CandidateTestPaperHistory(
                candidate_id=candidate.id,
                job_id=current_paper.job_id,
                job_stage_config_id=current_paper.job_stage_config_id,
                name=current_paper.name,
                questions=current_paper.questions,
                mcqs=current_paper.mcqs,
                project_task=current_paper.project_task,
                task_file_path=current_paper.task_file_path,
                task_skills=current_paper.task_skills,
                user_id=user.id,
                guideline_id=current_paper.guideline_id,
                guideline_content=current_paper.guideline_content,
            )
            db.add(history_entry)

            await send_candidate_task_email_via_smtp(candidate, current_paper, db)
            current_paper.email_sent_count += 1
            candidate.email_sent_count += 1
            db.add(current_paper)
            db.add(candidate)
            sent_emails.append(candidate.email)
        except Exception as e:
            logger.exception(f"Failed to send bulk email to {candidate.email}: {e}")
            failed_emails.append({"email": candidate.email, "error": str(e)})

    # Commit transactions
    await db.commit()

    if not sent_emails and failed_emails:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send any emails. Error sample: {failed_emails[0]['error']}",
        )

    return {
        "status": "success",
        "message": f"Assigned test paper email successfully processed: {len(sent_emails)} sent, {len(failed_emails)} failed.",
        "sent_to": sent_emails,
        "failed": failed_emails,
    }
