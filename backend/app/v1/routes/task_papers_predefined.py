import os
import uuid
from typing import Optional, Any
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, File as FastAPIFile, UploadFile, Form, Request, Response
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.core.config import settings
from app.v1.core.storage import resolve_storage_path, to_storage_relative_path
from app.v1.db.session import get_db
from app.v1.dependencies import check_permission
from app.v1.db.models.question_set_paper import QuestionSetPaper
from app.v1.db.models.departments import Department
from app.v1.db.models.skills import Skill
from app.v1.db.models.job_positions import JobPosition
from app.v1.schemas.task_papers import QuestionSetPaperRead, QuestionAction, TaskAction
from app.v1.schemas.user import UserRead
from app.v1.utils.uuid import UUIDHelper
from app.v1.core.decorators import cache_response
from app.v1.core.cache import cache

router = APIRouter()


@router.post("/upload", response_model=list[QuestionSetPaperRead], status_code=status.HTTP_201_CREATED)
async def upload_question_set_papers(
    department_id: uuid.UUID = Form(..., description="The associated department ID"),
    position_id: uuid.UUID = Form(..., description="The associated job position level ID"),
    skill_ids: Optional[str] = Form(None, description="Comma-separated or JSON list of associated skill IDs"),
    paper_type: str = Form("normal", description="The type of paper content to extract: 'normal', 'mcq', or 'task'"),
    task_file: UploadFile = FastAPIFile(..., description="A test paper PDF/Word file"),
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("questions:upload")),
):
    """Upload a test paper file directly for a specific department, experience position level, and skills."""
    if paper_type not in ["normal", "mcq", "task"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported paper type: {paper_type}. Supported types are 'normal', 'mcq', and 'task'.",
        )

    # Verify department exists
    dept = await db.get(Department, department_id)
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Department with ID {department_id} does not exist.",
        )

    # Verify position level exists
    position = await db.get(JobPosition, position_id)
    if not position:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job position level with ID {position_id} does not exist.",
        )

    # Parse skill_ids if provided
    parsed_skill_ids = []
    if skill_ids:
        import json
        try:
            parsed_skill_ids = [uuid.UUID(x) for x in json.loads(skill_ids)]
        except Exception:
            parsed_skill_ids = [uuid.UUID(x.strip()) for x in skill_ids.split(",") if x.strip()]

    # Fetch skills
    skills = []
    if parsed_skill_ids:
        stmt_skills = select(Skill).where(Skill.id.in_(parsed_skill_ids))
        skills = (await db.execute(stmt_skills)).scalars().all()

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
        department_id=department_id,
        position_id=position_id,
        paper_type=paper_type,
        questions=[],
        mcqs=[],
        project_task=[],
        task_file_path=stored_file_path,
        task_skills=None,
    )
    db_paper.skills = list(skills)
    db.add(db_paper)
    await db.commit()
    await cache.clear("cache:GET:/api/v1/task-papers*")
    await db.refresh(db_paper)

    # Trigger celery task to extract skills, questions, and task details in background
    from app.v1.services.admin.job_tasks import extract_paper_task_skills_task
    extract_paper_task_skills_task.delay(str(db_paper.id), db_paper.task_file_path, paper_type)

    return [db_paper]

from app.v1.schemas.task_papers import QuestionSetPaperCreate

@router.post("/manual", response_model=QuestionSetPaperRead, status_code=status.HTTP_201_CREATED)
async def create_manual_question_set_paper(
    payload: QuestionSetPaperCreate,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("questions:manage")),
):
    """Create a new manual Question Set Paper without a file upload."""
    paper_id = UUIDHelper.generate_uuid7()
    
    # Auto-generate a name
    from datetime import datetime
    paper_name = f"Custom Paper - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"

    # Fetch skills
    skills = []
    if payload.skill_ids:
        stmt_skills = select(Skill).where(Skill.id.in_(payload.skill_ids))
        skills = (await db.execute(stmt_skills)).scalars().all()

    db_paper = QuestionSetPaper(
        id=paper_id,
        name=paper_name,
        department_id=payload.department_id,
        position_id=payload.position_id,
        paper_type=payload.paper_type,
        questions=payload.questions,
        mcqs=[m.model_dump() for m in payload.mcqs] if payload.mcqs else [],
        project_task=payload.project_task,
        task_file_path=None,
        task_skills=None,
    )
    db_paper.skills = list(skills)
    db.add(db_paper)
    await db.commit()
    await cache.clear("cache:GET:/api/v1/task-papers*")
    await db.refresh(db_paper)
    
    # Trigger celery task to extract skills from manually provided text
    if db_paper.questions or db_paper.mcqs or db_paper.project_task:
        from app.v1.services.admin.job_tasks import extract_paper_skills_from_text_task
        extract_paper_skills_from_text_task.delay(str(db_paper.id))

    return db_paper


@router.get("", response_model=list[QuestionSetPaperRead])
@cache_response(ttl_seconds=300)
async def get_question_set_papers(
    request: Request,
    response: Response,
    department_id: Optional[uuid.UUID] = None,
    position_id: Optional[uuid.UUID] = None,
    skill_id: Optional[uuid.UUID] = None,
    paper_type: Optional[str] = None,
    job_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
):
    """List all predefined Question Set Papers, with optional filtering by department, position, skill, paper type, and job."""
    query = select(QuestionSetPaper)
    if job_id:
        from app.v1.db.models.jobs import Job
        from sqlalchemy.orm import selectinload
        stmt_job = select(Job).options(selectinload(Job.skills)).where(Job.id == job_id)
        job = (await db.execute(stmt_job)).scalar_one_or_none()
        if job:
            job_skill_ids = [s.id for s in job.skills]
            query = query.where(
                QuestionSetPaper.department_id == job.department_id,
                QuestionSetPaper.position_id == job.position_id
            )
            if job_skill_ids:
                query = query.where(QuestionSetPaper.skills.any(Skill.id.in_(job_skill_ids)))
            else:
                query = query.where(False)
    else:
        if department_id:
            query = query.where(QuestionSetPaper.department_id == department_id)
        if position_id:
            query = query.where(QuestionSetPaper.position_id == position_id)
        if skill_id:
            query = query.where(QuestionSetPaper.skills.any(Skill.id == skill_id))
            
    if paper_type:
        query = query.where(QuestionSetPaper.paper_type == paper_type)
    result = await db.execute(query)
    items = result.scalars().all()
    return [QuestionSetPaperRead.model_validate(item) for item in items]


@router.get("/all-content", response_model=list[list[Any]])
@cache_response(ttl_seconds=300)
async def get_all_questions_and_tasks(
    request: Request,
    response: Response,
    department_id: Optional[uuid.UUID] = None,
    position_id: Optional[uuid.UUID] = None,
    skill_id: Optional[uuid.UUID] = None,
    paper_type: Optional[str] = None,
    job_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
):
    """Retrieve unique questions, tasks, and MCQs across predefined question set papers, with optional filtering by job, department, position, skill, and paper type."""
    query = select(QuestionSetPaper.questions, QuestionSetPaper.project_task, QuestionSetPaper.mcqs)
    if job_id:
        from app.v1.db.models.jobs import Job
        from sqlalchemy.orm import selectinload
        stmt_job = select(Job).options(selectinload(Job.skills)).where(Job.id == job_id)
        job = (await db.execute(stmt_job)).scalar_one_or_none()
        if job:
            job_skill_ids = [s.id for s in job.skills]
            query = query.where(
                QuestionSetPaper.department_id == job.department_id,
                QuestionSetPaper.position_id == job.position_id
            )
            if job_skill_ids:
                query = query.where(QuestionSetPaper.skills.any(Skill.id.in_(job_skill_ids)))
            else:
                query = query.where(False)
    else:
        if department_id:
            query = query.where(QuestionSetPaper.department_id == department_id)
        if position_id:
            query = query.where(QuestionSetPaper.position_id == position_id)
        if skill_id:
            query = query.where(QuestionSetPaper.skills.any(Skill.id == skill_id))
            
    if paper_type:
        query = query.where(QuestionSetPaper.paper_type == paper_type)
        
    result = await db.execute(query)
    items = result.all()
    
    all_questions = set()
    all_tasks = set()
    all_mcqs = []
    seen_mcq_questions = set()
    
    for questions, tasks, mcqs in items:
        if questions:
            for q in questions:
                if isinstance(q, str):
                    all_questions.add(q)
                elif isinstance(q, dict):
                    val = q.get('question') or q.get('content')
                    if val and isinstance(val, str):
                        all_questions.add(val)
        if tasks:
            for t in tasks:
                if isinstance(t, str):
                    all_tasks.add(t)
                elif isinstance(t, dict):
                    val = t.get('task') or t.get('content') or t.get('task_title') or t.get('title')
                    if val and isinstance(val, str):
                        all_tasks.add(val)
        if mcqs:
            for m in mcqs:
                if isinstance(m, dict):
                    q_text = m.get("question")
                    if q_text and q_text not in seen_mcq_questions:
                        seen_mcq_questions.add(q_text)
                        # Exclude the answer key to show only the question and options
                        all_mcqs.append({
                            "question": q_text,
                            "options": m.get("options", [])
                        })
                
    return [list(all_questions), list(all_tasks), all_mcqs]


@router.get("/{paper_id}", response_model=QuestionSetPaperRead)
@cache_response(ttl_seconds=300)
async def get_question_set_paper(
    paper_id: uuid.UUID,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
):
    """Retrieve a specific predefined Question Set Paper."""
    paper = await db.get(QuestionSetPaper, paper_id)
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question set paper not found.",
        )
    return QuestionSetPaperRead.model_validate(paper)


@router.delete("/{paper_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question_set_paper(
    paper_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("questions:upload")),
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
    await cache.clear("cache:GET:/api/v1/task-papers*")
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

    abs_path = resolve_storage_path(task_file_path)
    if not abs_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task file not found on disk.",
        )

    original_ext = os.path.splitext(task_file_path)[1]
    safe_paper_name = "".join(c for c in paper.name if c.isalnum() or c in (' ', '-', '_')).replace(' ', '_')
    filename = f"{safe_paper_name}_Task_File{original_ext}"
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


@router.post("/{paper_id}/questions", response_model=QuestionSetPaperRead, status_code=status.HTTP_201_CREATED)
async def add_question_to_paper(
    paper_id: uuid.UUID,
    payload: QuestionAction,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("questions:manage")),
):
    """Add a new question to a specific Question Set Paper."""
    paper = await db.get(QuestionSetPaper, paper_id)
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question set paper not found.",
        )
    
    question_text = payload.question
    if not question_text:
        raise HTTPException(status_code=400, detail="Question text is required.")

    # Create a new list to ensure SQLAlchemy detects the change to JSONB
    new_questions = list(paper.questions)
    new_questions.append(question_text)
    paper.questions = new_questions
    
    await db.commit()
    await db.refresh(paper)
    await cache.clear("cache:GET:/api/v1/task-papers*")
    
    from app.v1.services.admin.job_tasks import extract_paper_skills_from_text_task
    extract_paper_skills_from_text_task.delay(str(paper.id))
    
    return QuestionSetPaperRead.model_validate(paper)


@router.put("/{paper_id}/questions/{index}", response_model=QuestionSetPaperRead)
async def update_question_in_paper(
    paper_id: uuid.UUID,
    index: int,
    payload: QuestionAction,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("questions:manage")),
):
    """Update a specific question in a Question Set Paper by its index."""
    paper = await db.get(QuestionSetPaper, paper_id)
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question set paper not found.",
        )
    
    question_text = payload.question
    if not question_text:
        raise HTTPException(status_code=400, detail="Question text is required.")

    if index < 0 or index >= len(paper.questions):
        raise HTTPException(status_code=400, detail="Invalid question index.")

    new_questions = list(paper.questions)
    new_questions[index] = question_text
    paper.questions = new_questions
    
    await db.commit()
    await db.refresh(paper)
    await cache.clear("cache:GET:/api/v1/task-papers*")
    
    from app.v1.services.admin.job_tasks import extract_paper_skills_from_text_task
    extract_paper_skills_from_text_task.delay(str(paper.id))
    
    return QuestionSetPaperRead.model_validate(paper)


@router.delete("/{paper_id}/questions/{index}", response_model=QuestionSetPaperRead)
async def delete_question_from_paper(
    paper_id: uuid.UUID,
    index: int,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("questions:manage")),
):
    """Delete a specific question from a Question Set Paper by its index."""
    paper = await db.get(QuestionSetPaper, paper_id)
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question set paper not found.",
        )
    
    if index < 0 or index >= len(paper.questions):
        raise HTTPException(status_code=400, detail="Invalid question index.")

    new_questions = list(paper.questions)
    new_questions.pop(index)
    paper.questions = new_questions
    
    await db.commit()
    await db.refresh(paper)
    await cache.clear("cache:GET:/api/v1/task-papers*")
    
    from app.v1.services.admin.job_tasks import extract_paper_skills_from_text_task
    extract_paper_skills_from_text_task.delay(str(paper.id))
    
    return QuestionSetPaperRead.model_validate(paper)

@router.post("/{paper_id}/tasks", response_model=QuestionSetPaperRead, status_code=status.HTTP_201_CREATED)
async def add_task_to_paper(
    paper_id: uuid.UUID,
    payload: TaskAction,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("questions:manage")),
):
    """Add a new task to a specific Question Set Paper."""
    paper = await db.get(QuestionSetPaper, paper_id)
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question set paper not found.",
        )
    
    task_text = payload.task
    if not task_text:
        raise HTTPException(status_code=400, detail="Task text is required.")

    new_tasks = list(paper.project_task) if paper.project_task else []
    new_tasks.append(task_text)
    paper.project_task = new_tasks
    
    await db.commit()
    await db.refresh(paper)
    await cache.clear("cache:GET:/api/v1/task-papers*")
    
    from app.v1.services.admin.job_tasks import extract_paper_skills_from_text_task
    extract_paper_skills_from_text_task.delay(str(paper.id))
    
    return QuestionSetPaperRead.model_validate(paper)

@router.put("/{paper_id}/tasks/{index}", response_model=QuestionSetPaperRead)
async def update_task_in_paper(
    paper_id: uuid.UUID,
    index: int,
    payload: TaskAction,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("questions:manage")),
):
    """Update a specific task in a Question Set Paper by its index."""
    paper = await db.get(QuestionSetPaper, paper_id)
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question set paper not found.",
        )
    
    task_text = payload.task
    if not task_text:
        raise HTTPException(status_code=400, detail="Task text is required.")

    if not paper.project_task or index < 0 or index >= len(paper.project_task):
        raise HTTPException(status_code=400, detail="Invalid task index.")

    new_tasks = list(paper.project_task)
    new_tasks[index] = task_text
    paper.project_task = new_tasks
    
    await db.commit()
    await db.refresh(paper)
    await cache.clear("cache:GET:/api/v1/task-papers*")
    
    from app.v1.services.admin.job_tasks import extract_paper_skills_from_text_task
    extract_paper_skills_from_text_task.delay(str(paper.id))
    
    return QuestionSetPaperRead.model_validate(paper)

@router.delete("/{paper_id}/tasks/{index}", response_model=QuestionSetPaperRead)
async def delete_task_from_paper(
    paper_id: uuid.UUID,
    index: int,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("questions:manage")),
):
    """Delete a specific task from a Question Set Paper by its index."""
    paper = await db.get(QuestionSetPaper, paper_id)
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question set paper not found.",
        )
    
    if not paper.project_task or index < 0 or index >= len(paper.project_task):
        raise HTTPException(status_code=400, detail="Invalid task index.")

    new_tasks = list(paper.project_task)
    new_tasks.pop(index)
    paper.project_task = new_tasks
    
    await db.commit()
    await db.refresh(paper)
    await cache.clear("cache:GET:/api/v1/task-papers*")
    
    from app.v1.services.admin.job_tasks import extract_paper_skills_from_text_task
    extract_paper_skills_from_text_task.delay(str(paper.id))
    
    return QuestionSetPaperRead.model_validate(paper)

