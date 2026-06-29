import os
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.session import get_db
from app.v1.dependencies import check_permission
from app.v1.db.models.question_set_paper import QuestionSetPaper
from app.v1.db.models.candidate_test_paper import CandidateTestPaper
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.job_stage_configs import JobStageConfig
from app.v1.db.models.stage_templates import StageTemplate
from app.v1.utils.pdf_generator import generate_candidate_task_pdf_file
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.jobs import Job
from app.v1.schemas.task_papers import CandidateTestPaperRead, CandidateTestPaperAssign
from app.v1.schemas.user import UserRead
from app.v1.schemas.upload import CandidateTaskRead, JobCandidateSkillsRead
from app.v1.services.admin.candidate_task_service import candidate_task_service
from app.v1.utils.stage import get_question_round_filter
from app.v1.routes.task_papers_assign_service import task_paper_assign_service
from app.v1.routes.task_papers_helpers import (
    get_candidate_active_job_id,
    get_candidate_active_stage_config_id,
    get_job_first_question_stage_config_id,
    are_tasks_equal,
)

router = APIRouter()


@router.post("/assign", response_model=CandidateTestPaperRead, status_code=status.HTTP_200_OK)
async def assign_test_paper_to_candidate(
    assign_data: CandidateTestPaperAssign,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:decide")),
):
    """Assign, randomly generate, or custom construct a test paper for a candidate or a job."""
    return await task_paper_assign_service.assign_test_paper(
        db=db, assign_data=assign_data, user=user
    )


@router.get("/assigned/{candidate_id}", response_model=CandidateTestPaperRead)
async def get_candidate_test_paper(
    candidate_id: uuid.UUID,
    job_stage_id: Optional[uuid.UUID] = Query(None, description="Optional job stage configuration ID"),
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
):
    """Retrieve the test paper currently assigned to the candidate."""
    active_stage_id = job_stage_id or await get_candidate_active_stage_config_id(db, candidate_id)

    stmt = select(CandidateTestPaper).where(CandidateTestPaper.candidate_id == candidate_id)
    if active_stage_id:
        stmt_stage = stmt.where(CandidateTestPaper.job_stage_config_id == active_stage_id)
        res = await db.execute(stmt_stage)
        paper = res.scalar_one_or_none()
        if not paper:
            stmt_none = stmt.where(CandidateTestPaper.job_stage_config_id.is_(None))
            res = await db.execute(stmt_none)
            paper = res.scalar_one_or_none()
    else:
        stmt = stmt.where(CandidateTestPaper.job_stage_config_id.is_(None))
        res = await db.execute(stmt)
        paper = res.scalar_one_or_none()

    is_candidate_specific = (paper is not None)

    if not paper:
        # Fallback to job-level default test paper!
        candidate = await db.get(Candidate, candidate_id)
        if candidate:
            job_id = await get_candidate_active_job_id(db, candidate)
            if job_id:
                stmt_job = select(CandidateTestPaper).where(
                    CandidateTestPaper.job_id == job_id,
                    CandidateTestPaper.candidate_id.is_(None)
                )
                if active_stage_id:
                    stmt_job_stage = stmt_job.where(CandidateTestPaper.job_stage_config_id == active_stage_id)
                    res_job = await db.execute(stmt_job_stage)
                    paper = res_job.scalar_one_or_none()
                    if not paper:
                        stmt_job_none = stmt_job.where(CandidateTestPaper.job_stage_config_id.is_(None))
                        res_job = await db.execute(stmt_job_none)
                        paper = res_job.scalar_one_or_none()
                else:
                    # No active stage resolved: try job's first question stage, then NULL fallback
                    auto_stage_id = await get_job_first_question_stage_config_id(db, job_id)
                    if auto_stage_id:
                        stmt_job_auto = stmt_job.where(CandidateTestPaper.job_stage_config_id == auto_stage_id)
                        res_job = await db.execute(stmt_job_auto)
                        paper = res_job.scalar_one_or_none()
                    if not paper:
                        stmt_job_none = stmt_job.where(CandidateTestPaper.job_stage_config_id.is_(None))
                        res_job = await db.execute(stmt_job_none)
                        paper = res_job.scalar_one_or_none()

    if not paper:
        # Check if candidate has reached a Question/Practical stage
        stmt_stage = (
            select(CandidateStage)
            .join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
            .join(StageTemplate, JobStageConfig.template_id == StageTemplate.id)
            .where(
                CandidateStage.candidate_id == candidate_id,
                get_question_round_filter(JobStageConfig, StageTemplate),
                CandidateStage.status.in_(["active", "completed"])
            )
        )
        if active_stage_id:
            stmt_stage = stmt_stage.where(CandidateStage.job_stage_id == active_stage_id)

        res_stage = await db.execute(stmt_stage)
        stages = res_stage.scalars().all()
        if not stages:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No test paper assigned. Candidate has not reached the test paper stage yet.",
            )
        
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No test paper assigned to this candidate.",
        )

    # Set default values for comparison fields
    paper.job_default_paper_changed = False
    paper.job_default_paper_name = None
    paper.job_default_paper_id = None

    if is_candidate_specific:
        # Check if job-level default paper is different
        candidate = await db.get(Candidate, candidate_id)
        if candidate:
            job_id = await get_candidate_active_job_id(db, candidate)
            if job_id:
                stmt_job = select(CandidateTestPaper).where(
                    CandidateTestPaper.job_id == job_id,
                    CandidateTestPaper.candidate_id.is_(None)
                )
                job_paper = None
                if active_stage_id:
                    stmt_job_stage = stmt_job.where(CandidateTestPaper.job_stage_config_id == active_stage_id)
                    res_job = await db.execute(stmt_job_stage)
                    job_paper = res_job.scalar_one_or_none()
                    if not job_paper:
                        stmt_job_none = stmt_job.where(CandidateTestPaper.job_stage_config_id.is_(None))
                        res_job = await db.execute(stmt_job_none)
                        job_paper = res_job.scalar_one_or_none()
                else:
                    # No active stage: try job's first question stage, then NULL fallback
                    auto_stage_id = await get_job_first_question_stage_config_id(db, job_id)
                    if auto_stage_id:
                        stmt_job_auto = stmt_job.where(CandidateTestPaper.job_stage_config_id == auto_stage_id)
                        res_job = await db.execute(stmt_job_auto)
                        job_paper = res_job.scalar_one_or_none()
                    if not job_paper:
                        stmt_job_none = stmt_job.where(CandidateTestPaper.job_stage_config_id.is_(None))
                        res_job = await db.execute(stmt_job_none)
                        job_paper = res_job.scalar_one_or_none()
                if job_paper:
                    if (paper.name != job_paper.name or
                        not are_tasks_equal(paper.project_task, job_paper.project_task) or
                        paper.task_file_path != job_paper.task_file_path or
                        paper.questions != job_paper.questions or
                        paper.mcqs != job_paper.mcqs):
                        paper.job_default_paper_changed = True
                        paper.job_default_paper_name = job_paper.name
                        paper.job_default_paper_id = job_paper.id

    return paper


@router.delete("/assigned/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_candidate_test_paper(
    candidate_id: uuid.UUID,
    job_stage_id: Optional[uuid.UUID] = Query(None, description="Optional job stage configuration ID"),
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:decide")),
):
    """Unassign/delete the candidate's test paper."""
    active_stage_id = job_stage_id or await get_candidate_active_stage_config_id(db, candidate_id)

    # Verify if Question/Practical stage is completed
    stmt_stage = (
        select(CandidateStage, StageTemplate.name)
        .join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
        .join(StageTemplate, JobStageConfig.template_id == StageTemplate.id)
        .where(
            CandidateStage.candidate_id == candidate_id,
            get_question_round_filter(JobStageConfig, StageTemplate)
        )
    )
    if active_stage_id:
        stmt_stage = stmt_stage.where(CandidateStage.job_stage_id == active_stage_id)

    res_stage = await db.execute(stmt_stage)
    for s, stage_name in res_stage.all():
        if s.status == "completed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot assign or modify test paper after the candidate has completed the {stage_name}.",
            )

    stmt = select(CandidateTestPaper).where(CandidateTestPaper.candidate_id == candidate_id)
    if active_stage_id:
        stmt_stage = stmt.where(CandidateTestPaper.job_stage_config_id == active_stage_id)
        res = await db.execute(stmt_stage)
        paper = res.scalar_one_or_none()
        if not paper:
            stmt_none = stmt.where(CandidateTestPaper.job_stage_config_id.is_(None))
            res = await db.execute(stmt_none)
            paper = res.scalar_one_or_none()
    else:
        stmt = stmt.where(CandidateTestPaper.job_stage_config_id.is_(None))
        res = await db.execute(stmt)
        paper = res.scalar_one_or_none()
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No test paper assigned to this candidate.",
        )
    job_id = paper.job_id
    await db.delete(paper)
    await db.commit()

    # Invalidate job cache immediately after deleting candidate test paper
    if job_id:
        try:
            from app.v1.services.admin.system_service import system_service
            await system_service.invalidate_job_cache(job_id)
        except Exception:
            pass

    return


@router.get("/assigned/job/{job_id}", response_model=CandidateTestPaperRead)
async def get_job_default_test_paper(
    job_id: uuid.UUID,
    job_stage_id: Optional[uuid.UUID] = Query(None, description="Optional job stage configuration ID"),
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
):
    """Retrieve the default common test paper assigned to the job (where candidate_id is null)."""
    if job_stage_id:
        # Explicit stage requested → strict lookup, no fallback
        stmt = select(CandidateTestPaper).where(
            CandidateTestPaper.job_id == job_id,
            CandidateTestPaper.candidate_id.is_(None),
            CandidateTestPaper.job_stage_config_id == job_stage_id
        )
        res = await db.execute(stmt)
        paper = res.scalar_one_or_none()
        if not paper:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No default test paper assigned to this job for the specified stage.",
            )
        return paper

    # No stage given → auto-resolve first question round, then fallback to any job default
    resolved_stage_id = await get_job_first_question_stage_config_id(db, job_id)

    stmt = select(CandidateTestPaper).where(
        CandidateTestPaper.job_id == job_id,
        CandidateTestPaper.candidate_id.is_(None)
    )
    if resolved_stage_id:
        stmt = stmt.where(CandidateTestPaper.job_stage_config_id == resolved_stage_id)
    else:
        stmt = stmt.where(CandidateTestPaper.job_stage_config_id.is_(None))
    res = await db.execute(stmt)
    paper = res.scalars().first()

    if not paper:
        # Fallback: try any job default paper (including legacy stage-agnostic ones)
        stmt_fallback = select(CandidateTestPaper).where(
            CandidateTestPaper.job_id == job_id,
            CandidateTestPaper.candidate_id.is_(None)
        ).limit(1)
        res = await db.execute(stmt_fallback)
        paper = res.scalar_one_or_none()

    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No default test paper assigned to this job.",
        )
    return paper


@router.delete("/assigned/job/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job_default_test_paper(
    job_id: uuid.UUID,
    job_stage_id: Optional[uuid.UUID] = Query(None, description="Optional job stage configuration ID"),
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:decide")),
):
    """Delete the default common test paper assigned to the job."""
    # Auto-resolve the first question-type round if no explicit stage id given.
    resolved_stage_id = job_stage_id or await get_job_first_question_stage_config_id(db, job_id)

    stmt = select(CandidateTestPaper).where(
        CandidateTestPaper.job_id == job_id,
        CandidateTestPaper.candidate_id.is_(None)
    )
    if resolved_stage_id:
        stmt = stmt.where(CandidateTestPaper.job_stage_config_id == resolved_stage_id)
    else:
        stmt = stmt.where(CandidateTestPaper.job_stage_config_id.is_(None))
    res = await db.execute(stmt)
    paper = res.scalar_one_or_none()
    if not paper:
        # Fallback: try any job default paper (including legacy stage-agnostic ones)
        stmt_fallback = select(CandidateTestPaper).where(
            CandidateTestPaper.job_id == job_id,
            CandidateTestPaper.candidate_id.is_(None)
        ).limit(1)
        res = await db.execute(stmt_fallback)
        paper = res.scalar_one_or_none()
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No default test paper assigned to this job.",
        )
    await db.delete(paper)
    await db.commit()

    # Invalidate job cache immediately after deleting job default test paper
    try:
        from app.v1.services.admin.system_service import system_service
        await system_service.invalidate_job_cache(job_id)
    except Exception:
        pass

    return


@router.get(
    "/assigned/{candidate_id}/task",
    response_model=CandidateTaskRead,
    status_code=status.HTTP_200_OK,
)
async def read_candidate_task(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserRead = Depends(check_permission("candidates:access")),
) -> Any:
    """Retrieve only the task PDF file path, extracted skills, and custom flag for a candidate."""
    return await candidate_task_service.get_candidate_task_skills(
        db=db,
        candidate_id=candidate_id,
    )


@router.get(
    "/assigned/{candidate_id}/jobs/{job_id}/skills",
    response_model=JobCandidateSkillsRead,
    status_code=status.HTTP_200_OK,
)
async def get_job_and_candidate_task_skills(
    candidate_id: uuid.UUID,
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserRead = Depends(check_permission("candidates:access")),
) -> Any:
    """Retrieve job standard skills and custom/fallback task skills for a candidate and job."""
    return await candidate_task_service.get_candidate_and_job_skills(
        db=db,
        candidate_id=candidate_id,
        job_id=job_id,
    )


@router.get(
    "/assigned/{candidate_id}/task/file",
    status_code=status.HTTP_200_OK,
)
async def download_candidate_task_file(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserRead = Depends(check_permission("candidates:access")),
) -> Any:
    """
    Download/view the candidate's custom task file.
    Dynamically generates a PDF containing the assigned questions and project task.
    """
    from app.v1.core.storage import resolve_storage_path

    # 1. Fetch Candidate from DB
    candidate = await db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # 2. Get Test Paper
    active_stage_id = await get_candidate_active_stage_config_id(db, candidate_id)
    stmt_paper = select(CandidateTestPaper).where(CandidateTestPaper.candidate_id == candidate_id)
    if active_stage_id:
        stmt_paper_stage = stmt_paper.where(CandidateTestPaper.job_stage_config_id == active_stage_id)
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

    if not test_paper:
        candidate = await db.get(Candidate, candidate_id)
        if candidate:
            job_id = await get_candidate_active_job_id(db, candidate)
            if job_id:
                stmt_job = select(CandidateTestPaper).where(
                    CandidateTestPaper.job_id == job_id,
                    CandidateTestPaper.candidate_id.is_(None)
                )
                if active_stage_id:
                    stmt_job_stage = stmt_job.where(CandidateTestPaper.job_stage_config_id == active_stage_id)
                    res_job = await db.execute(stmt_job_stage)
                    test_paper = res_job.scalar_one_or_none()
                    if not test_paper:
                        stmt_job_none = stmt_job.where(CandidateTestPaper.job_stage_config_id.is_(None))
                        res_job = await db.execute(stmt_job_none)
                        test_paper = res_job.scalar_one_or_none()
                else:
                    # No active stage: try job's first question stage, then NULL fallback
                    auto_stage_id = await get_job_first_question_stage_config_id(db, job_id)
                    if auto_stage_id:
                        stmt_job_auto = stmt_job.where(CandidateTestPaper.job_stage_config_id == auto_stage_id)
                        res_job = await db.execute(stmt_job_auto)
                        test_paper = res_job.scalar_one_or_none()
                    if not test_paper:
                        stmt_job_none = stmt_job.where(CandidateTestPaper.job_stage_config_id.is_(None))
                        res_job = await db.execute(stmt_job_none)
                        test_paper = res_job.scalar_one_or_none()

    if not test_paper:
        # Check if candidate has reached a Question/Practical stage before failing
        stmt_stage = (
            select(CandidateStage)
            .join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
            .join(StageTemplate, JobStageConfig.template_id == StageTemplate.id)
            .where(
                CandidateStage.candidate_id == candidate_id,
                get_question_round_filter(JobStageConfig, StageTemplate),
                CandidateStage.status.in_(["active", "completed"])
            )
        )
        if active_stage_id:
            stmt_stage = stmt_stage.where(CandidateStage.job_stage_id == active_stage_id)
        res_stage = await db.execute(stmt_stage)
        stages = res_stage.scalars().all()
        if not stages:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No test paper assigned. Candidate has not reached the test paper stage yet.",
            )
            
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No test paper assigned to this candidate.",
        )

    task_file_path = candidate.task_file_path or (test_paper.task_file_path if test_paper else None)

    # 4. Check if the paper has overridden questions/task compared to the template
    is_modified = True
    if test_paper:
        if test_paper.name == "Custom Test Paper" or test_paper.name.startswith("Randomized Test Paper"):
            is_modified = True
        elif test_paper.task_file_path:
            # Find the original QuestionSetPaper by task_file_path
            stmt_orig = select(QuestionSetPaper).where(QuestionSetPaper.task_file_path == test_paper.task_file_path)
            res_orig = await db.execute(stmt_orig)
            orig_paper = res_orig.scalars().first()
            if orig_paper:
                # Compare questions, mcqs and project task
                if (orig_paper.questions == test_paper.questions and 
                    are_tasks_equal(orig_paper.project_task, test_paper.project_task) and
                    getattr(orig_paper, "mcqs", []) == getattr(test_paper, "mcqs", [])):
                    is_modified = False

    # 5. If it's a PDF and not modified, or if it's a non-PDF file, serve it directly
    if task_file_path:
        if not is_modified or not task_file_path.lower().endswith(".pdf"):
            abs_path = resolve_storage_path(task_file_path)
            if abs_path.is_file():
                original_ext = os.path.splitext(task_file_path)[1]
                filename = f"Test_Paper_{candidate.first_name or 'Candidate'}{original_ext}"
                media_type = "application/octet-stream"
                if filename.lower().endswith(".pdf"):
                    media_type = "application/pdf"
                elif filename.lower().endswith(".docx"):
                    media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                elif filename.lower().endswith(".doc"):
                    media_type = "application/msword"

                return FileResponse(
                    path=abs_path,
                    filename=filename,
                    media_type=media_type
                )

    # 6. Generate PDF dynamically containing the assigned questions + project task
    if test_paper:
        # Fetch job name for the PDF header
        job = await db.get(Job, test_paper.job_id)
        job_name = job.title if job else ""
        temp_pdf_path = generate_candidate_task_pdf_file(candidate, test_paper, job_name=job_name)
        return FileResponse(
            path=temp_pdf_path,
            filename=f"Test_Paper_{candidate.first_name or 'Candidate'}.pdf",
            media_type="application/pdf"
        )

    return None
