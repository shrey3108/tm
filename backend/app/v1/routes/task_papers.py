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
    CandidateTestPaperBulkEmailSend,
)
from app.v1.schemas.user import UserRead
from app.v1.schemas.upload import CandidateTaskRead, JobCandidateSkillsRead
from app.v1.services.admin.candidate_task_service import candidate_task_service
from app.v1.utils.uuid import UUIDHelper

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

    paper_id = UUIDHelper.generate_uuid7()
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
    """Assign, randomly generate, or custom construct a test paper for a candidate or a job."""
    if not assign_data.candidate_id and not assign_data.job_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either candidate_id or job_id must be provided.",
        )

    candidate_id = None
    job_id = None
    position_id = None
    job = None

    if assign_data.candidate_id:
        # Verify Candidate exists by ID
        candidate = await db.get(Candidate, assign_data.candidate_id)
        if not candidate:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Candidate with ID {assign_data.candidate_id} not found.",
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
    else:
        # Assign at Job level (public/common test paper for this job)
        job_id = assign_data.job_id
        job = await db.get(Job, job_id)
        if not job or not job.position_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Job does not exist or does not have an experience level position configured.",
            )
        position_id = job.position_id

        # Delete any existing job-level default test paper
        await db.execute(
            delete(CandidateTestPaper).where(
                CandidateTestPaper.job_id == job_id,
                CandidateTestPaper.candidate_id.is_(None)
            )
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

        # We removed strict job_id / position_id matching here to allow HR
        # to flexibly assign tests from other banks if they explicitly choose to.

        assigned_name = paper.name
        # Allow overriding template questions/tasks manually
        assigned_questions = assign_data.questions if assign_data.questions is not None else paper.questions
        assigned_task = assign_data.project_task if assign_data.project_task is not None else paper.project_task
        assigned_file_path = paper.task_file_path
        assigned_skills = paper.task_skills

    elif assign_data.mode == "random":
        # Fetch all question set papers matching the candidate's job and position level
        stmt = select(QuestionSetPaper)
        if assign_data.source_paper_ids:
            stmt = stmt.where(QuestionSetPaper.id.in_(assign_data.source_paper_ids))
        else:
            # Fallback to candidate's applied job matching if no specific sources are chosen
            stmt = stmt.where(
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

        if unique_questions:
            assigned_questions = random.sample(unique_questions, min(5, len(unique_questions)))
        else:
            assigned_questions = []

    elif assign_data.mode == "custom":
        if not assign_data.questions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="'questions' list is required when mode is 'custom'.",
            )
            
            
        assigned_name = "Custom Test Paper"
        assigned_questions = assign_data.questions
        assigned_task = assign_data.project_task or ""
        assigned_file_path = None
        assigned_skills = None
        
        if assign_data.base_paper_id:
            base_paper = await db.get(QuestionSetPaper, assign_data.base_paper_id)
            if base_paper:
                assigned_task = assign_data.project_task or base_paper.project_task or ""
                assigned_file_path = base_paper.task_file_path
                assigned_skills = base_paper.task_skills

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
        # Fallback to job-level default test paper!
        candidate = await db.get(Candidate, candidate_id)
        if candidate and candidate.applied_job_id:
            stmt_job = select(CandidateTestPaper).where(
                CandidateTestPaper.job_id == candidate.applied_job_id,
                CandidateTestPaper.candidate_id.is_(None)
            )
            res_job = await db.execute(stmt_job)
            paper = res_job.scalar_one_or_none()

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


@router.get("/assigned/job/{job_id}", response_model=CandidateTestPaperRead)
async def get_job_default_test_paper(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
):
    """Retrieve the default common test paper assigned to the job (where candidate_id is null)."""
    stmt = select(CandidateTestPaper).where(
        CandidateTestPaper.job_id == job_id,
        CandidateTestPaper.candidate_id.is_(None)
    )
    res = await db.execute(stmt)
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
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:decide")),
):
    """Delete the default common test paper assigned to the job."""
    stmt = select(CandidateTestPaper).where(
        CandidateTestPaper.job_id == job_id,
        CandidateTestPaper.candidate_id.is_(None)
    )
    res = await db.execute(stmt)
    paper = res.scalar_one_or_none()
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No default test paper assigned to this job.",
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


def generate_candidate_task_pdf_file(
    candidate: Candidate,
    test_paper: CandidateTestPaper
) -> str:
    import fitz
    import tempfile
    
    doc = fitz.open()
    
    # Prepare text content
    text_content = f"Test Paper: {test_paper.name}\n"
    text_content += "-" * 50 + "\n\n"
    
    if test_paper.questions:
        text_content += "Questions:\n"
        for i, q in enumerate(test_paper.questions):
            text_content += f"{i+1}. {q}\n\n"
    
    if test_paper.project_task:
        text_content += f"Project Task:\n{test_paper.project_task}\n\n"

    rect = fitz.Rect(50, 110, 550, 750)
    lines = text_content.split("\n")
    remaining_lines = lines
    
    while remaining_lines:
        page = doc.new_page()
        
        # Insert Logo at Top Left
        logo_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "frontend", "src", "assets", "logo.svg")
        if os.path.exists(logo_path):
            try:
                svg_doc = fitz.open(logo_path)
                pdf_bytes = svg_doc.convert_to_pdf()
                pdf_doc = fitz.open("pdf", pdf_bytes)
                page.show_pdf_page(fitz.Rect(50, 40, 200, 80), pdf_doc, 0)
            except Exception as e:
                print(f"Failed to load logo: {e}")
        
        # Add Footer
        footer_text = "32, SAI ASHISH SOCIETY PART-1, BEHIND VIJAY SALES, NR. CHANDNI CHOWK,\nPIPLOD, SURAT 395007 | www.augustinfotech.com"
        page.insert_textbox(
            fitz.Rect(50, 780, 550, 830), 
            footer_text, 
            fontsize=10, 
            fontname="hebo", 
            align=fitz.TEXT_ALIGN_CENTER
        )
        
        fitted_lines_count = 0
        temp_text = ""
        
        for line in remaining_lines:
            test_text = temp_text + line + "\n"
            
            test_doc = fitz.open()
            test_page = test_doc.new_page()
            rc = test_page.insert_textbox(rect, test_text, fontsize=11, fontname="helv")
            test_doc.close()
            
            if rc >= 0:
                temp_text = test_text
                fitted_lines_count += 1
            else:
                break
                
        if fitted_lines_count == 0:
            page.insert_textbox(rect, remaining_lines[0], fontsize=11, fontname="helv")
            remaining_lines = remaining_lines[1:]
        else:
            page.insert_textbox(rect, temp_text.rstrip("\n"), fontsize=11, fontname="helv")
            remaining_lines = remaining_lines[fitted_lines_count:]

    # Save to temp file
    temp_pdf = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    temp_pdf.close() # Close the file handle so PyMuPDF can write to it on Windows
    doc.save(temp_pdf.name)
    doc.close()
    return temp_pdf.name


async def send_candidate_task_email_via_smtp(
    candidate: Candidate,
    test_paper: CandidateTestPaper,
    db: AsyncSession
) -> None:
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.base import MIMEBase
    from email import encoders
    import asyncio
    import logging
    
    logger = logging.getLogger(__name__)

    # 1. Determine attachment and details
    temp_file_to_delete = None
    attachment_path = None
    attachment_name = None
    
    task_file_path = candidate.task_file_path or test_paper.task_file_path
    is_modified = True
    
    if test_paper:
        if test_paper.name == "Custom Test Paper" or test_paper.name.startswith("Randomized Test Paper"):
            is_modified = True
        elif test_paper.task_file_path:
            # Find the original QuestionSetPaper by task_file_path
            from app.v1.db.models.question_set_paper import QuestionSetPaper
            stmt_orig = select(QuestionSetPaper).where(QuestionSetPaper.task_file_path == test_paper.task_file_path)
            res_orig = await db.execute(stmt_orig)
            orig_paper = res_orig.scalar_one_or_none()
            if orig_paper:
                if orig_paper.questions == test_paper.questions and orig_paper.project_task == test_paper.project_task:
                    is_modified = False

    external_url = None
    if task_file_path and task_file_path.startswith(("http://", "https://")):
        external_url = task_file_path
    elif task_file_path and (not is_modified or not task_file_path.lower().endswith(".pdf")):
        abs_path = resolve_storage_path(task_file_path)
        if abs_path.is_file():
            attachment_path = str(abs_path)
            attachment_name = os.path.basename(task_file_path)
    else:
        # Generate PDF dynamically
        try:
            temp_file_to_delete = generate_candidate_task_pdf_file(candidate, test_paper)
            attachment_path = temp_file_to_delete
            attachment_name = f"Test_Paper_{candidate.first_name or 'Candidate'}.pdf"
        except Exception as e:
            logger.error(f"Failed to generate task PDF for email: {e}")

    # 2. Build HTML body
    details_html = ""
    if test_paper.questions or test_paper.project_task or external_url:
        details_html += '<div class="details-box">'
        if test_paper.questions:
            details_html += '<div class="details-title">Assigned Questions:</div>'
            details_html += '<ol class="questions-list">'
            for q in test_paper.questions:
                details_html += f'<li>{q}</li>'
            details_html += '</ol>'
        if test_paper.project_task:
            if test_paper.questions:
                details_html += '<br>'
            details_html += '<div class="details-title">Project Task:</div>'
            details_html += f'<div style="font-size: 14px; line-height: 1.5; color: #4b5563; white-space: pre-wrap;">{test_paper.project_task}</div>'
        if external_url:
            if test_paper.questions or test_paper.project_task:
                details_html += '<br>'
            details_html += '<div class="details-title">External Task Link:</div>'
            details_html += f'<div style="font-size: 14px;"><a href="{external_url}" target="_blank" style="color: #3b82f6; text-decoration: underline;">{external_url}</a></div>'
        details_html += '</div>'

    html_body = f"""
    <html>
      <head>
        <style>
          body {{
            font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
            background-color: #f4f6f9;
            color: #333333;
            margin: 0;
            padding: 0;
          }}
          .container {{
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            overflow: hidden;
            border: 1px solid #eef2f6;
          }}
          .header {{
            background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
            padding: 30px;
            text-align: center;
            color: #ffffff;
          }}
          .header h1 {{
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.5px;
          }}
          .content {{
            padding: 40px 30px;
          }}
          .greeting {{
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 20px;
            color: #111827;
          }}
          .message {{
            font-size: 15px;
            line-height: 1.6;
            color: #4b5563;
            margin-bottom: 30px;
          }}
          .details-box {{
            background-color: #f9fafb;
            border-radius: 8px;
            padding: 20px;
            border-left: 4px solid #3b82f6;
            margin-bottom: 30px;
          }}
          .details-title {{
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 10px;
          }}
          .questions-list {{
            margin: 0;
            padding-left: 20px;
            color: #4b5563;
          }}
          .questions-list li {{
            margin-bottom: 10px;
            font-size: 14px;
            line-height: 1.5;
          }}
          .footer {{
            background-color: #f9fafb;
            padding: 20px 30px;
            text-align: center;
            font-size: 12px;
            color: #9ca3af;
            border-top: 1px solid #eef2f6;
          }}
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Hiring Assessment</h1>
          </div>
          <div class="content">
            <div class="greeting">Hello {candidate.first_name or "Candidate"},</div>
            <div class="message">
              We are pleased to invite you to take the next step in our interview process. A test paper <strong>"{test_paper.name}"</strong> has been assigned to you.
            </div>
            
            {details_html}

            <div class="message">
              Please review the questions and tasks above. If a PDF is attached, it contains the full details of your test paper.
            </div>
          </div>
          <div class="footer">
            August Infotech<br>
            32, SAI ASHISH SOCIETY PART-1, BEHIND VIJAY SALES, NR. CHANDNI CHOWK,<br>
            PIPLOD, SURAT 395007 | www.augustinfotech.com
          </div>
        </div>
      </body>
    </html>
    """

    # SMTP Configuration
    smtp_host = settings.SMTP_HOST
    smtp_port = settings.SMTP_PORT
    smtp_user = settings.SMTP_USER
    smtp_password = settings.SMTP_PASSWORD
    smtp_from = settings.SMTP_FROM_EMAIL

    # Override target recipient to the user-requested hardcoded safety test email
    target_recipient = "shuklashrey31@gmail.com"

    # Build MIME message
    msg = MIMEMultipart()
    msg["From"] = smtp_from
    msg["To"] = target_recipient
    msg["Subject"] = f"[TEST] Test Paper Assigned for {candidate.first_name or 'Candidate'} {candidate.last_name or ''} (intended for: {candidate.email})"
    
    msg.attach(MIMEText(html_body, "html"))

    if attachment_path and attachment_name:
        try:
            with open(attachment_path, "rb") as f:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(f.read())
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                f"attachment; filename={attachment_name}",
            )
            msg.attach(part)
        except Exception as e:
            logger.error(f"Failed to attach file to email: {e}")

    # Send email synchronously in threadpool to avoid blocking event loop
    def send_sync():
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.sendmail(smtp_from, [target_recipient], msg.as_string())

    try:
        await asyncio.to_thread(send_sync)
    finally:
        if temp_file_to_delete and os.path.exists(temp_file_to_delete):
            try:
                os.unlink(temp_file_to_delete)
            except Exception:
                pass


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
    # 1. Fetch Candidate from DB
    candidate = await db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # 2. Get Test Paper
    stmt_paper = select(CandidateTestPaper).where(CandidateTestPaper.candidate_id == candidate_id)
    res_paper = await db.execute(stmt_paper)
    test_paper = res_paper.scalar_one_or_none()
    
    if not test_paper and candidate.applied_job_id:
        stmt_job = select(CandidateTestPaper).where(
            CandidateTestPaper.job_id == candidate.applied_job_id,
            CandidateTestPaper.candidate_id.is_(None)
        )
        res_job = await db.execute(stmt_job)
        test_paper = res_job.scalar_one_or_none()

    task_file_path = candidate.task_file_path or (test_paper.task_file_path if test_paper else None)

    # 3. Handle URL (e.g. GitHub URL or external link)
    if task_file_path and task_file_path.startswith(("http://", "https://")):
        return RedirectResponse(url=task_file_path)

    # 4. Check if the paper has overridden questions/task compared to the template
    is_modified = True
    if test_paper:
        if test_paper.name == "Custom Test Paper" or test_paper.name.startswith("Randomized Test Paper"):
            is_modified = True
        elif test_paper.task_file_path:
            # Find the original QuestionSetPaper by task_file_path
            from app.v1.db.models.question_set_paper import QuestionSetPaper
            stmt_orig = select(QuestionSetPaper).where(QuestionSetPaper.task_file_path == test_paper.task_file_path)
            res_orig = await db.execute(stmt_orig)
            orig_paper = res_orig.scalar_one_or_none()
            if orig_paper:
                # Compare questions list and project task
                if orig_paper.questions == test_paper.questions and orig_paper.project_task == test_paper.project_task:
                    is_modified = False

    # 5. If it's a PDF and not modified, or if it's a non-PDF file, serve it directly
    if task_file_path:
        if not is_modified or not task_file_path.lower().endswith(".pdf"):
            abs_path = resolve_storage_path(task_file_path)
            if abs_path.is_file():
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

    # 6. Generate PDF dynamically containing the assigned questions + project task
    if test_paper:
        temp_pdf_path = generate_candidate_task_pdf_file(candidate, test_paper)
        return FileResponse(
            path=temp_pdf_path,
            filename=f"Test_Paper_{candidate.first_name or 'Candidate'}.pdf",
            media_type="application/pdf"
        )

    return None


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
        if not (paper.candidate_id is None and paper.job_id == candidate.applied_job_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The specified test paper does not belong to this candidate.",
            )

    try:
        await send_candidate_task_email_via_smtp(candidate, paper, db)
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.exception(f"SMTP error in send_test_paper_email: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send email via SMTP: {str(e)}",
        )

    return {
        "status": "success",
        "message": f"Assigned test paper email successfully sent to shuklashrey31@gmail.com (intended for: {candidate.email}).",
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
            if not (paper.candidate_id is None and paper.job_id == candidate.applied_job_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"The specified test paper does not belong to candidate {candidate.email}.",
                )

    # 4. Send email logic for each candidate
    import logging
    logger = logging.getLogger(__name__)
    sent_emails = []
    failed_emails = []
    for candidate in candidates:
        try:
            await send_candidate_task_email_via_smtp(candidate, paper, db)
            sent_emails.append(candidate.email)
        except Exception as e:
            logger.exception(f"Failed to send bulk email to {candidate.email}: {e}")
            failed_emails.append({"email": candidate.email, "error": str(e)})

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

