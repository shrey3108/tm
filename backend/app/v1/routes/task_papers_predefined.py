import os
import uuid
from typing import Optional, Any
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, File as FastAPIFile, UploadFile, Form, Request, Response, Query
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
from app.v1.schemas.task_papers import QuestionSetPaperRead, QuestionAction, TaskAction, MCQAction
from app.v1.schemas.user import UserRead
from app.v1.utils.uuid import UUIDHelper
from app.v1.core.decorators import cache_response
from app.v1.core.cache import cache

router = APIRouter()


async def handle_duplicate_question(
    question_text: str,
    department_id: uuid.UUID,
    position_id: uuid.UUID,
    current_skills: list[Skill],
    db: AsyncSession,
) -> bool:
    """
    Checks if a question already exists in any predefined paper under the same department and position.
    If it exists, adds any missing skills to that paper and commits.
    Returns True if a duplicate was found.
    """
    stmt = (
        select(QuestionSetPaper)
        .where(
            QuestionSetPaper.department_id == department_id,
            QuestionSetPaper.position_id == position_id,
            QuestionSetPaper.questions.contains([question_text])
        )
    )
    res = await db.execute(stmt)
    existing_papers = res.scalars().all()
    if existing_papers:
        for ep in existing_papers:
            existing_skill_ids = {s.id for s in ep.skills}
            for s in current_skills:
                if s.id not in existing_skill_ids:
                    ep.skills.append(s)
        await db.commit()
        return True
    return False


async def handle_duplicate_mcq(
    mcq_question_text: str,
    department_id: uuid.UUID,
    position_id: uuid.UUID,
    current_skills: list[Skill],
    db: AsyncSession,
) -> bool:
    """
    Checks if an MCQ (by its question text) already exists in any predefined paper under the same department and position.
    If it exists, adds any missing skills to that paper and commits.
    Returns True if a duplicate was found.
    """
    stmt = (
        select(QuestionSetPaper)
        .where(
            QuestionSetPaper.department_id == department_id,
            QuestionSetPaper.position_id == position_id
        )
    )
    res = await db.execute(stmt)
    papers = res.scalars().all()
    found = False
    for paper in papers:
        if paper.mcqs:
            for m in paper.mcqs:
                if m.get("question") == mcq_question_text:
                    existing_skill_ids = {s.id for s in paper.skills}
                    for s in current_skills:
                        if s.id not in existing_skill_ids:
                            paper.skills.append(s)
                    found = True
                    break
    if found:
        await db.commit()
        return True
    return False


async def handle_duplicate_task(
    task_text: str,
    department_id: uuid.UUID,
    position_id: uuid.UUID,
    current_skills: list[Skill],
    db: AsyncSession,
) -> bool:
    """
    Checks if a task (by its task description text) already exists in any predefined paper under the same department and position.
    If it exists, adds any missing skills to that paper and commits.
    Returns True if a duplicate was found.
    """
    stmt = (
        select(QuestionSetPaper)
        .where(
            QuestionSetPaper.department_id == department_id,
            QuestionSetPaper.position_id == position_id
        )
    )
    res = await db.execute(stmt)
    papers = res.scalars().all()
    found = False
    for paper in papers:
        if paper.project_task:
            for t in paper.project_task:
                if isinstance(t, dict) and t.get("task") == task_text:
                    existing_skill_ids = {s.id for s in paper.skills}
                    for s in current_skills:
                        if s.id not in existing_skill_ids:
                            paper.skills.append(s)
                    found = True
                    break
                elif isinstance(t, str) and t == task_text:
                    existing_skill_ids = {s.id for s in paper.skills}
                    for s in current_skills:
                        if s.id not in existing_skill_ids:
                            paper.skills.append(s)
                    found = True
                    break
    if found:
        await db.commit()
        return True
    return False


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

    if not skills:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one valid skill ID must be provided.",
        )

    # Local duplicate validation inside the payload
    if payload.questions and len(payload.questions) != len(set(payload.questions)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate questions are not allowed in the same paper.",
        )
    if payload.mcqs:
        mcq_qs = [m.question for m in payload.mcqs]
        if len(mcq_qs) != len(set(mcq_qs)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Duplicate MCQs are not allowed in the same paper.",
            )
    if payload.project_task:
        task_descs = [t.task for t in payload.project_task]
        if len(task_descs) != len(set(task_descs)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Duplicate tasks are not allowed in the same paper.",
            )

    # Global/system duplicate validation
    if payload.questions:
        for q in payload.questions:
            if await handle_duplicate_question(q, payload.department_id, payload.position_id, skills, db):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This question already exists in the system. The existing question bank has been updated with the new skill.",
                )

    if payload.mcqs:
        for m in payload.mcqs:
            if await handle_duplicate_mcq(m.question, payload.department_id, payload.position_id, skills, db):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This MCQ already exists in the system. The existing question bank has been updated with the new skill.",
                )

    if payload.project_task:
        for t in payload.project_task:
            if await handle_duplicate_task(t.task, payload.department_id, payload.position_id, skills, db):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This task already exists in the system. The existing question bank has been updated with the new skill.",
                )

    # Process source_mix for hybrid mode
    final_questions = list(payload.questions) if payload.questions else []
    final_mcqs = [m.model_dump() for m in payload.mcqs] if payload.mcqs else []
    final_tasks = [t.model_dump() for t in payload.project_task] if payload.project_task else []

    if getattr(payload, "source_mix", None):
        for mix_item in payload.source_mix:
            source_paper = await db.get(QuestionSetPaper, mix_item.paper_id)
            if not source_paper:
                continue
            
            # Extract questions
            if source_paper.questions and mix_item.question_indices:
                for idx in mix_item.question_indices:
                    if 0 <= idx < len(source_paper.questions):
                        final_questions.append(source_paper.questions[idx])
            
            # Extract mcqs
            if source_paper.mcqs and mix_item.mcq_indices:
                for idx in mix_item.mcq_indices:
                    if 0 <= idx < len(source_paper.mcqs):
                        final_mcqs.append(source_paper.mcqs[idx])
            
            # Extract tasks
            if source_paper.project_task and mix_item.task_indices:
                for idx in mix_item.task_indices:
                    if 0 <= idx < len(source_paper.project_task):
                        final_tasks.append(source_paper.project_task[idx])

    db_paper = QuestionSetPaper(
        id=paper_id,
        name=paper_name,
        department_id=payload.department_id,
        position_id=payload.position_id,
        paper_type=payload.paper_type,
        questions=final_questions,
        mcqs=final_mcqs,
        project_task=final_tasks,
        task_file_path=None,
        task_skills=None,
    )
    db_paper.skills = list(skills)
    db.add(db_paper)
    await db.commit()
    await cache.clear("cache:GET:/api/v1/task-papers*")
    await db.refresh(db_paper)
    


    return db_paper


from sqlalchemy import func
from app.v1.schemas.task_papers import QuestionSetPaperListRead

@router.get("", response_model=QuestionSetPaperListRead)
@cache_response(ttl_seconds=300)
async def get_question_set_papers(
    request: Request,
    response: Response,
    department_id: Optional[uuid.UUID] = None,
    position_id: Optional[uuid.UUID] = None,
    skill_id: Optional[uuid.UUID] = None,
    paper_type: Optional[str] = None,
    job_id: Optional[uuid.UUID] = None,
    q: Optional[str] = Query(None, description="Search term for paper name"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
):
    """List predefined Question Set Papers, with optional pagination, search, and filtering."""
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
        
    if q:
        query = query.where(QuestionSetPaper.name.ilike(f"%{q}%"))
        
    # Get total count before pagination
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Apply pagination and sorting
    query = query.order_by(QuestionSetPaper.created_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    items = result.scalars().all()
    
    data = [QuestionSetPaperRead.model_validate(item) for item in items]
    return QuestionSetPaperListRead(data=data, total=total)



@router.get("/all-content", response_model=dict[str, list[Any]])
@cache_response(ttl_seconds=300)
async def get_all_questions_and_tasks(
    request: Request,
    response: Response,
    department_id: Optional[uuid.UUID] = None,
    position_id: Optional[uuid.UUID] = None,
    skill_id: Optional[uuid.UUID] = None,
    paper_type: Optional[str] = None,
    job_id: Optional[uuid.UUID] = None,
    q: Optional[str] = Query(None, description="Search term for question/task text"),
    skip: int = Query(0, ge=0),
    limit: Optional[int] = Query(None, ge=1),
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
):
    """Retrieve unique questions, tasks, and MCQs across predefined question set papers, with optional filtering, search, and pagination."""
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
            for question_item in questions:
                if isinstance(question_item, str):
                    all_questions.add(question_item)
                elif isinstance(question_item, dict):
                    val = question_item.get('question') or question_item.get('content')
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
                        
    if q:
        q_lower = q.lower()
        all_questions = {x for x in all_questions if q_lower in x.lower()}
        all_tasks = {x for x in all_tasks if q_lower in x.lower()}
        all_mcqs = [m for m in all_mcqs if q_lower in m.get("question", "").lower()]

    q_list = list(all_questions)
    t_list = list(all_tasks)
    
    if limit is not None:
        q_list = q_list[skip:skip + limit]
        t_list = t_list[skip:skip + limit]
        all_mcqs = all_mcqs[skip:skip + limit]
    elif skip > 0:
        q_list = q_list[skip:]
        t_list = t_list[skip:]
        all_mcqs = all_mcqs[skip:]
                
    return {
        "questions": q_list,
        "project_task": t_list,
        "mcqs": all_mcqs
    }


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

    # 1. Local duplicate check
    if paper.questions and question_text in paper.questions:
        raise HTTPException(status_code=400, detail="This question already exists in this paper.")

    # 2. System duplicate check
    if await handle_duplicate_question(question_text, paper.department_id, paper.position_id, paper.skills, db):
        raise HTTPException(status_code=400, detail="This question already exists in the system. The existing question bank has been updated with the new skill.")

    # Create a new list to ensure SQLAlchemy detects the change to JSONB
    new_questions = list(paper.questions)
    new_questions.append(question_text)
    paper.questions = new_questions
    
    await db.commit()
    await db.refresh(paper)
    await cache.clear("cache:GET:/api/v1/task-papers*")
    
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
    if new_questions[index] != question_text:
        if question_text in new_questions:
            raise HTTPException(status_code=400, detail="This question already exists in this paper.")
        if await handle_duplicate_question(question_text, paper.department_id, paper.position_id, paper.skills, db):
            raise HTTPException(status_code=400, detail="This question already exists in the system. The existing question bank has been updated with the new skill.")

    new_questions[index] = question_text
    paper.questions = new_questions
    
    await db.commit()
    await db.refresh(paper)
    await cache.clear("cache:GET:/api/v1/task-papers*")
    
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
    

    
    return QuestionSetPaperRead.model_validate(paper)

@router.post("/{paper_id}/mcqs", response_model=QuestionSetPaperRead, status_code=status.HTTP_201_CREATED)
async def add_mcq_to_paper(
    paper_id: uuid.UUID,
    payload: MCQAction,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("questions:manage")),
):
    """Add a new MCQ to a specific Question Set Paper."""
    paper = await db.get(QuestionSetPaper, paper_id)
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question set paper not found.",
        )
    
    mcq_data = payload.mcq
    if not mcq_data:
        raise HTTPException(status_code=400, detail="MCQ data is required.")

    # 1. Local duplicate check
    current_mcqs = paper.mcqs or []
    mcq_question = mcq_data.get("question") if isinstance(mcq_data, dict) else getattr(mcq_data, "question", None)
    if not mcq_question:
        raise HTTPException(status_code=400, detail="MCQ question text is required.")

    if any(m.get("question") == mcq_question for m in current_mcqs):
        raise HTTPException(status_code=400, detail="This MCQ already exists in this paper.")

    # 2. System duplicate check
    if await handle_duplicate_mcq(mcq_question, paper.department_id, paper.position_id, paper.skills, db):
        raise HTTPException(status_code=400, detail="This MCQ already exists in the system. The existing question bank has been updated with the new skill.")

    # Create a new list to ensure SQLAlchemy detects the change to JSONB
    new_mcqs = list(paper.mcqs or [])
    new_mcqs.append(mcq_data)
    paper.mcqs = new_mcqs
    
    await db.commit()
    await db.refresh(paper)
    await cache.clear("cache:GET:/api/v1/task-papers*")
    
    return QuestionSetPaperRead.model_validate(paper)

@router.put("/{paper_id}/mcqs/{index}", response_model=QuestionSetPaperRead)
async def update_mcq_in_paper(
    paper_id: uuid.UUID,
    index: int,
    payload: MCQAction,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("questions:manage")),
):
    """Update a specific MCQ in a Question Set Paper by its index."""
    paper = await db.get(QuestionSetPaper, paper_id)
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question set paper not found.",
        )
    
    mcq_data = payload.mcq
    if not mcq_data:
        raise HTTPException(status_code=400, detail="MCQ data is required.")

    current_mcqs = paper.mcqs or []
    if index < 0 or index >= len(current_mcqs):
        raise HTTPException(status_code=400, detail="Invalid MCQ index.")

    mcq_question = mcq_data.get("question") if isinstance(mcq_data, dict) else getattr(mcq_data, "question", None)
    if not mcq_question:
        raise HTTPException(status_code=400, detail="MCQ question text is required.")

    new_mcqs = list(current_mcqs)
    if new_mcqs[index].get("question") != mcq_question:
        if any(m.get("question") == mcq_question for m in new_mcqs):
            raise HTTPException(status_code=400, detail="This MCQ already exists in this paper.")
        if await handle_duplicate_mcq(mcq_question, paper.department_id, paper.position_id, paper.skills, db):
            raise HTTPException(status_code=400, detail="This MCQ already exists in the system. The existing question bank has been updated with the new skill.")

    new_mcqs[index] = mcq_data
    paper.mcqs = new_mcqs
    
    await db.commit()
    await db.refresh(paper)
    await cache.clear("cache:GET:/api/v1/task-papers*")
    
    return QuestionSetPaperRead.model_validate(paper)

@router.delete("/{paper_id}/mcqs/{index}", response_model=QuestionSetPaperRead)
async def delete_mcq_from_paper(
    paper_id: uuid.UUID,
    index: int,
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("questions:manage")),
):
    """Delete a specific MCQ from a Question Set Paper by its index."""
    paper = await db.get(QuestionSetPaper, paper_id)
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question set paper not found.",
        )
    
    current_mcqs = paper.mcqs or []
    if index < 0 or index >= len(current_mcqs):
        raise HTTPException(status_code=400, detail="Invalid MCQ index.")

    new_mcqs = list(current_mcqs)
    new_mcqs.pop(index)
    paper.mcqs = new_mcqs
    
    await db.commit()
    await db.refresh(paper)
    await cache.clear("cache:GET:/api/v1/task-papers*")
    

    
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
    
    task_obj = payload.task
    if not task_obj:
        raise HTTPException(status_code=400, detail="Task object is required.")

    # 1. Local duplicate check
    current_tasks = paper.project_task or []
    for t in current_tasks:
        t_text = t.get("task") if isinstance(t, dict) else t
        if t_text == task_obj.task:
            raise HTTPException(status_code=400, detail="This task already exists in this paper.")

    # 2. System duplicate check
    if await handle_duplicate_task(task_obj.task, paper.department_id, paper.position_id, paper.skills, db):
        raise HTTPException(status_code=400, detail="This task already exists in the system. The existing question bank has been updated with the new skill.")

    new_tasks = list(paper.project_task) if paper.project_task else []
    new_tasks.append(task_obj.model_dump())
    paper.project_task = new_tasks
    
    await db.commit()
    await db.refresh(paper)
    await cache.clear("cache:GET:/api/v1/task-papers*")
    
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
    
    task_obj = payload.task
    if not task_obj:
        raise HTTPException(status_code=400, detail="Task object is required.")

    if not paper.project_task or index < 0 or index >= len(paper.project_task):
        raise HTTPException(status_code=400, detail="Invalid task index.")

    new_tasks = list(paper.project_task)
    current_t = new_tasks[index]
    current_text = current_t.get("task") if isinstance(current_t, dict) else current_t

    if current_text != task_obj.task:
        for t in new_tasks:
            t_text = t.get("task") if isinstance(t, dict) else t
            if t_text == task_obj.task:
                raise HTTPException(status_code=400, detail="This task already exists in this paper.")
        if await handle_duplicate_task(task_obj.task, paper.department_id, paper.position_id, paper.skills, db):
            raise HTTPException(status_code=400, detail="This task already exists in the system. The existing question bank has been updated with the new skill.")

    new_tasks[index] = task_obj.model_dump()
    paper.project_task = new_tasks
    
    await db.commit()
    await db.refresh(paper)
    await cache.clear("cache:GET:/api/v1/task-papers*")
    
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
    

    
    return QuestionSetPaperRead.model_validate(paper)

