import os
import uuid
import random
from typing import Any, Optional, List
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, File as FastAPIFile, UploadFile, Form
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import delete, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.core.config import settings
from app.v1.core.storage import resolve_storage_path, to_storage_relative_path
from app.v1.db.session import get_db
from app.v1.dependencies import check_permission
from app.v1.db.models.question_set_paper import QuestionSetPaper
from app.v1.db.models.candidate_test_paper import CandidateTestPaper
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.jobs import Job
from app.v1.db.models.job_positions import JobPosition
from app.v1.schemas.task_papers import (
    QuestionSetPaperCreate,
    QuestionSetPaperRead,
    CandidateTestPaperRead,
    CandidateTestPaperAssign,
    CandidateTestPaperEmailSend,
)
from app.v1.schemas.user import UserRead
from app.v1.schemas.upload import CandidateTaskRead, JobCandidateSkillsRead
from app.v1.services.admin.candidate_task_service import candidate_task_service

router = APIRouter()


@router.post("/upload", response_model=list[QuestionSetPaperRead], status_code=status.HTTP_201_CREATED)
async def upload_question_set_papers(
    job_id: uuid.UUID = Form(..., description="The associated job ID"),
    position_id: uuid.UUID = Form(..., description="The associated job position level ID"),
    task_file: UploadFile = FastAPIFile(..., description="A test paper PDF/Word file"),
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:decide")),
):
    """Upload a test paper file directly for a specific job and experience position level."""
    # Verify job exists
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job with ID {job_id} does not exist.",
        )

    # Verify position level exists
    position = await db.get(JobPosition, position_id)
    if not position:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job position level with ID {position_id} does not exist.",
        )

    # Validate file extension
    file_extension = Path(task_file.filename).suffix.lower()
    if file_extension not in [".pdf", ".docx", ".doc"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format: {file_extension}. Only PDF, DOC, and DOCX are allowed.",
        )

    # Setup upload directory
    tasks_dir = resolve_storage_path(settings.TASK_UPLOAD_DIR)
    tasks_dir.mkdir(parents=True, exist_ok=True)

    paper_id = uuid.uuid4()
    file_name = f"paper_{paper_id}{file_extension}"
    target_path = tasks_dir / file_name
    stored_file_path = to_storage_relative_path(target_path)

    try:
        content = await task_file.read()
        target_path.write_bytes(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save uploaded file: {task_file.filename}.",
        )

    db_paper = QuestionSetPaper(
        id=paper_id,
        name=task_file.filename,
        job_id=job_id,
        position_id=position_id,
        questions=[],
        project_task="",
        task_file_path=stored_file_path,
        task_skills=None,
    )
    db.add(db_paper)
    await db.commit()
    await db.refresh(db_paper)

    # Trigger celery task to extract skills, questions, and task details in background
    from app.v1.services.admin.job_tasks import extract_paper_task_skills_task
    extract_paper_task_skills_task.delay(str(db_paper.id), db_paper.task_file_path)

    return [db_paper]


@router.get("", response_model=list[QuestionSetPaperRead])
async def get_question_set_papers(
    job_id: Optional[uuid.UUID] = None,
    position_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
):
    """List all predefined Question Set Papers, with optional filtering by job and experience level."""
    query = select(QuestionSetPaper)
    if job_id:
        query = query.where(QuestionSetPaper.job_id == job_id)
    if position_id:
        query = query.where(QuestionSetPaper.position_id == position_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{paper_id}", response_model=QuestionSetPaperRead)
async def get_question_set_paper(
    paper_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
):
    """Retrieve a specific predefined Question Set Paper."""
    paper = await db.get(QuestionSetPaper, paper_id)
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Predefined Question Set Paper not found.",
        )
    return paper


@router.delete("/{paper_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question_set_paper(
    paper_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:decide")),
):
    """Delete a predefined Question Set Paper."""
    paper = await db.get(QuestionSetPaper, paper_id)
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Predefined Question Set Paper not found.",
        )
    await db.delete(paper)
    await db.commit()
    return

@router.get("/{paper_id}/task-file")
async def download_paper_task_file(
    paper_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
):
    """Download/view the predefined Question Set Paper's task file."""
    paper = await db.get(QuestionSetPaper, paper_id)
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Predefined Question Set Paper not found.",
        )

    task_file_path = paper.task_file_path
    if not task_file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No task file uploaded for this paper.",
        )

    if task_file_path.startswith(("http://", "https://")):
        return RedirectResponse(url=task_file_path)

    abs_path = resolve_storage_path(task_file_path)
    if not abs_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task file not found on disk.",
        )

    filename = os.path.basename(task_file_path)
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


@router.post("/assign", response_model=CandidateTestPaperRead, status_code=status.HTTP_200_OK)
async def assign_test_paper_to_candidate(
    assign_data: CandidateTestPaperAssign,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:decide")),
):
    """Assign, randomly generate, or custom construct a test paper for a candidate using their email."""
    # Verify Candidate exists by email
    stmt = select(Candidate).where(func.lower(Candidate.email) == assign_data.candidate_email.lower())
    res = await db.execute(stmt)
    candidate = res.scalar_one_or_none()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate with email {assign_data.candidate_email} not found.",
        )

    candidate_id = candidate.id

    if not candidate.applied_job_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Candidate does not have an associated job.",
        )

    # Fetch candidate's job position level
    job = await db.get(Job, candidate.applied_job_id)
    if not job or not job.position_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Candidate's job does not have an experience level position configured.",
        )

    job_id = candidate.applied_job_id
    position_id = job.position_id

    # Delete any existing test paper assignment for this candidate to prevent unique constraint conflicts
    await db.execute(
        delete(CandidateTestPaper).where(CandidateTestPaper.candidate_id == candidate_id)
    )
    await db.commit()

    assigned_name = ""
    assigned_questions = []
    assigned_task = ""
    assigned_file_path = None
    assigned_skills = None

    if assign_data.mode == "predefined":
        if not assign_data.paper_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="paper_id is required when mode is 'predefined'.",
            )
        paper = await db.get(QuestionSetPaper, assign_data.paper_id)
        if not paper:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Predefined Question Set Paper not found.",
            )

        if paper.job_id != job_id or paper.position_id != position_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The selected predefined paper does not match the candidate's job and position level.",
            )

        assigned_name = paper.name
        # Allow overriding template questions/tasks manually
        assigned_questions = assign_data.questions if assign_data.questions is not None else paper.questions
        assigned_task = assign_data.project_task if assign_data.project_task is not None else paper.project_task
        assigned_file_path = paper.task_file_path
        assigned_skills = paper.task_skills

    elif assign_data.mode == "random":
        # Fetch all question set papers matching the candidate's job and position level
        stmt = select(QuestionSetPaper).where(
            QuestionSetPaper.job_id == job_id,
            QuestionSetPaper.position_id == position_id,
        )
        res = await db.execute(stmt)
        papers = res.scalars().all()

        if not papers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No question set papers available for this job and experience level to generate a random test.",
            )

        # Collect all questions from matching papers
        all_questions = []
        for p in papers:
            if p.questions:
                all_questions.extend(p.questions)

        # Ensure we have at least 5 unique questions or fallback to total pool
        unique_questions = list(set(all_questions))
        if len(unique_questions) < 5:
            unique_questions = all_questions

        # Select one task randomly (associated file path and skills come from that same chosen paper)
        chosen_paper = random.choice(papers)
        assigned_task = chosen_paper.project_task
        assigned_file_path = chosen_paper.task_file_path
        assigned_skills = chosen_paper.task_skills
        assigned_name = f"Randomized Test Paper ({job.title})"

        # If questions pool has less than 5 questions, fall back to default or custom
        if len(unique_questions) < 5:
            if assign_data.questions and len(assign_data.questions) == 5:
                assigned_questions = assign_data.questions
            else:
                assigned_questions = [f"Interview Question {i} for {job.title}" for i in range(1, 6)]
        else:
            assigned_questions = random.sample(unique_questions, 5)

    elif assign_data.mode == "custom":
        if not assign_data.questions or not assign_data.project_task:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Both 'questions' and 'project_task' are required when mode is 'custom'.",
            )
        if len(assign_data.questions) != 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Custom questions list must contain exactly 5 items.",
            )
        assigned_name = "Custom Test Paper"
        assigned_questions = assign_data.questions
        assigned_task = assign_data.project_task
        assigned_file_path = None
        assigned_skills = None

    # Persist the assigned test paper
    new_paper = CandidateTestPaper(
        candidate_id=candidate_id,
        job_id=job_id,
        position_id=position_id,
        name=assigned_name,
        questions=assigned_questions,
        project_task=assigned_task,
        task_file_path=assigned_file_path,
        task_skills=assigned_skills,
    )
    db.add(new_paper)
    await db.commit()
    await db.refresh(new_paper)
    return new_paper


@router.get("/assigned/{candidate_id}", response_model=CandidateTestPaperRead)
async def get_candidate_test_paper(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
):
    """Retrieve the test paper currently assigned to the candidate."""
    stmt = select(CandidateTestPaper).where(CandidateTestPaper.candidate_id == candidate_id)
    res = await db.execute(stmt)
    paper = res.scalar_one_or_none()
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No test paper assigned to this candidate.",
        )
    return paper


@router.delete("/assigned/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_candidate_test_paper(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:decide")),
):
    """Unassign/delete the candidate's test paper."""
    stmt = select(CandidateTestPaper).where(CandidateTestPaper.candidate_id == candidate_id)
    res = await db.execute(stmt)
    paper = res.scalar_one_or_none()
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No test paper assigned to this candidate.",
        )
    await db.delete(paper)
    await db.commit()
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
    Returns FileResponse/RedirectResponse if candidate's custom task exists, otherwise returns None (null).
    """
    # 1. Fetch Candidate from DB
    candidate = await db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # 2. Get task file path (only custom task, no fallback)
    task_file_path = candidate.task_file_path
    if not task_file_path:
        stmt_paper = select(CandidateTestPaper).where(CandidateTestPaper.candidate_id == candidate_id)
        res_paper = await db.execute(stmt_paper)
        test_paper = res_paper.scalar_one_or_none()
        if test_paper and test_paper.task_file_path:
            task_file_path = test_paper.task_file_path
        else:
            return None

    # 3. Handle URL (e.g. GitHub URL or external link)
    if task_file_path.startswith(("http://", "https://")):
        return RedirectResponse(url=task_file_path)

    # 4. Resolve local file path
    abs_path = resolve_storage_path(task_file_path)
    if not abs_path.is_file():
        return None

    filename = os.path.basename(task_file_path)
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The specified test paper does not belong to this candidate.",
        )

    # Log/Mock sending email logic
    import logging
    logger = logging.getLogger(__name__)
    logger.info(
        f"Simulating email sent to {candidate.email} for test paper: {paper.name}\n"
        f"Questions:\n" + "\n".join(f"- {q}" for q in paper.questions) + f"\n"
        f"Project Task: {paper.project_task}\n"
        f"Task File Path: {paper.task_file_path or 'None'}"
    )

    return {
        "status": "success",
        "message": f"Assigned test paper email successfully triggered/sent to {candidate.email}.",
    }
