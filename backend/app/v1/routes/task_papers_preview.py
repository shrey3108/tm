import uuid
import random
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.session import get_db
from app.v1.dependencies import check_permission
from app.v1.db.models.question_set_paper import QuestionSetPaper
from app.v1.db.models.jobs import Job
from app.v1.db.models.skills import Skill
from app.v1.schemas.task_papers import TaskPaperPreviewResponse
from app.v1.schemas.user import UserRead

router = APIRouter()

@router.get("/preview-random", response_model=TaskPaperPreviewResponse)
async def preview_random_questions(
    job_id: Optional[uuid.UUID] = Query(None, description="The job ID to match skills and department"),
    department_id: Optional[uuid.UUID] = Query(None, description="The department ID to filter papers"),
    position_id: Optional[uuid.UUID] = Query(None, description="The position ID to filter papers"),
    skill_ids: list[uuid.UUID] = Query(default=[], description="List of skill IDs to match"),
    count: int = Query(10, description="The number of random questions to generate"),
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("questions:read")),
):
    """
    Generate a random preview of questions based on a job's skills or explicitly provided department, position, and skills.
    These questions are tagged with their skill prefix.
    """
    if job_id:
        stmt_job = select(Job).options(selectinload(Job.skills)).where(Job.id == job_id)
        job = (await db.execute(stmt_job)).scalar_one_or_none()
        
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found.",
            )
            
        job_skill_ids = [s.id for s in job.skills]
        dept_id = job.department_id
        pos_id = job.position_id
    else:
        if not department_id or not position_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either job_id must be provided, or both department_id and position_id must be provided.",
            )
        job_skill_ids = skill_ids
        dept_id = department_id
        pos_id = position_id
    
    stmt = select(QuestionSetPaper).options(selectinload(QuestionSetPaper.skills))
    stmt = stmt.where(
        QuestionSetPaper.department_id == dept_id,
        QuestionSetPaper.position_id == pos_id
    )
    if job_skill_ids:
        stmt = stmt.where(QuestionSetPaper.skills.any(Skill.id.in_(job_skill_ids)))
    else:
        stmt = stmt.where(False)
        
    res = await db.execute(stmt)
    papers = res.scalars().all()

    if not papers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No question set papers available for the given criteria to generate a random test.",
        )

    all_questions = []
    all_mcqs = []
    
    for p in papers:
        if p.questions:
            all_questions.extend(p.questions)
        if p.mcqs:
            for m in p.mcqs:
                new_m = m.copy() if isinstance(m, dict) else getattr(m, "model_dump", lambda: m)()
                all_mcqs.append(new_m)

    seen_questions = set()
    unique_questions = []
    for q in all_questions:
        q_text = q.get("question") if isinstance(q, dict) else getattr(q, "question", str(q))
        if q_text and q_text not in seen_questions:
            seen_questions.add(q_text)
            if isinstance(q, str):
                unique_questions.append({"question": q, "marks": 5, "duration": 3})
            else:
                unique_questions.append(q)
    seen_mcq_questions = set()
    unique_mcqs = []
    for m in all_mcqs:
        q_text = m.get("question") if isinstance(m, dict) else getattr(m, "question", "")
        if q_text and q_text not in seen_mcq_questions:
            seen_mcq_questions.add(q_text)
            unique_mcqs.append(m)

    assigned_questions = []
    if unique_questions:
        assigned_questions = random.sample(unique_questions, min(count, len(unique_questions)))

    assigned_mcqs = []
    if unique_mcqs:
        selected_mcqs = random.sample(unique_mcqs, min(count, len(unique_mcqs)))
        assigned_mcqs = [m.model_dump(mode="json") if hasattr(m, "model_dump") else m for m in selected_mcqs]

    papers_with_tasks = [p for p in papers if p.project_task and len(p.project_task) > 0]
    if papers_with_tasks:
        chosen_task_paper = random.choice(papers_with_tasks)
        assigned_task = chosen_task_paper.project_task
    else:
        assigned_task = []
    return TaskPaperPreviewResponse(
        questions=assigned_questions,
        mcqs=assigned_mcqs,
        project_task=assigned_task
    )
