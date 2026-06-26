"""
Helper utilities for the task-papers-assigned routes.

Extracted from task_papers_assigned.py to keep the route file focused on
endpoint definitions. These helpers resolve candidate/job stage context and
manage auto-saving of custom question/MCQ/task items.
"""
import re
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.models.question_set_paper import QuestionSetPaper
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.job_stage_configs import JobStageConfig
from app.v1.db.models.stage_templates import StageTemplate
from app.v1.db.models.candidates import Candidate
from app.v1.utils.stage import get_question_round_filter
from app.v1.routes.task_papers_predefined import (
    handle_duplicate_question,
    handle_duplicate_mcq,
    handle_duplicate_task,
)


async def get_candidate_active_job_id(db: AsyncSession, candidate: Candidate) -> Optional[uuid.UUID]:
    """Resolve the candidate's active job ID.
    Looks up CandidateStage for an active Technical Practical / Question-required stage.
    Falls back to candidate.applied_job_id if no active stage exists.
    """
    stmt = (
        select(JobStageConfig.job_id)
        .join(CandidateStage, CandidateStage.job_stage_id == JobStageConfig.id)
        .join(StageTemplate, JobStageConfig.template_id == StageTemplate.id)
        .where(
            CandidateStage.candidate_id == candidate.id,
            CandidateStage.status == "active",
            get_question_round_filter(JobStageConfig, StageTemplate)
        )
        .limit(1)
    )

    res = await db.execute(stmt)
    active_job_id = res.scalar_one_or_none()
    if active_job_id:
        return active_job_id
    return candidate.applied_job_id


async def get_candidate_active_stage_config_id(db: AsyncSession, candidate_id: uuid.UUID) -> Optional[uuid.UUID]:
    """Resolve the candidate's active stage config ID for question/practical rounds."""
    stmt = (
        select(CandidateStage.job_stage_id)
        .join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
        .join(StageTemplate, JobStageConfig.template_id == StageTemplate.id)
        .where(
            CandidateStage.candidate_id == candidate_id,
            CandidateStage.status == "active",
            get_question_round_filter(JobStageConfig, StageTemplate)
        )
        .limit(1)
    )
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def get_job_first_question_stage_config_id(db: AsyncSession, job_id: uuid.UUID) -> Optional[uuid.UUID]:
    """Resolve the first (lowest stage_order) question-type JobStageConfig for a job.
    
    This is used to automatically tie job-level default papers to the first
    question round rather than making them stage-agnostic (NULL).
    """
    stmt = (
        select(JobStageConfig.id)
        .join(StageTemplate, JobStageConfig.template_id == StageTemplate.id)
        .where(
            JobStageConfig.job_id == job_id,
            get_question_round_filter(JobStageConfig, StageTemplate)
        )
        .order_by(JobStageConfig.stage_order)
        .limit(1)
    )
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


def parse_frontend_custom_task(text: str) -> tuple[str, str] | None:
    if not text:
        return None
    pattern = r"^Task:\s*\n(.*?)\n+Instructions:\s*\n(.*)$"
    match = re.match(pattern, text.strip(), re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip(), match.group(2).strip()
    return None


async def auto_save_custom_items(
    questions: list,
    mcqs: list,
    tasks: list,
    department_id: uuid.UUID,
    position_id: uuid.UUID,
    db: AsyncSession
):
    if not department_id or not position_id:
        return
    if not questions and not mcqs and not tasks:
        return

    # Check if we need to create the auto-saved paper
    stmt = select(QuestionSetPaper).where(
        QuestionSetPaper.department_id == department_id,
        QuestionSetPaper.position_id == position_id,
        QuestionSetPaper.name == "Auto-Saved Custom Questions"
    )
    res = await db.execute(stmt)
    auto_paper = res.scalars().first()
    
    needs_save = False
    
    new_q = list(auto_paper.questions) if auto_paper and auto_paper.questions else []
    new_m = list(auto_paper.mcqs) if auto_paper and auto_paper.mcqs else []
    new_t = list(auto_paper.project_task) if auto_paper and auto_paper.project_task else []

    if questions:
        for q in questions:
            q_text = q.get("question") if isinstance(q, dict) else q.question if hasattr(q, "question") else str(q)
            if not await handle_duplicate_question(q, department_id, position_id, [], db):
                new_q.append(q if isinstance(q, dict) else q.model_dump() if hasattr(q, "model_dump") else q)
                needs_save = True

    if mcqs:
        for m in mcqs:
            m_text = m.get("question") if isinstance(m, dict) else m.question if hasattr(m, "question") else str(m)
            if not await handle_duplicate_mcq(m_text, department_id, position_id, [], db):
                new_m.append(m if isinstance(m, dict) else m.model_dump() if hasattr(m, "model_dump") else m)
                needs_save = True
                
    if tasks:
        for t in tasks:
            t_text = t.get("task") if isinstance(t, dict) else t.task if hasattr(t, "task") else str(t)
            if not await handle_duplicate_task(t_text, department_id, position_id, [], db):
                new_t.append(t if isinstance(t, dict) else t.model_dump() if hasattr(t, "model_dump") else t)
                needs_save = True

    if needs_save:
        if not auto_paper:
            auto_paper = QuestionSetPaper(
                department_id=department_id,
                position_id=position_id,
                name="Auto-Saved Custom Questions",
                paper_type="mixed",
                questions=[],
                mcqs=[],
                project_task=[]
            )
            db.add(auto_paper)
        auto_paper.questions = new_q
        auto_paper.mcqs = new_m
        auto_paper.project_task = new_t
        await db.commit()


def are_tasks_equal(tasks_a, tasks_b) -> bool:
    def normalize_task(t):
        if not t:
            return {"task": "", "instructions": ""}
        if isinstance(t, str):
            return {"task": t.strip(), "instructions": ""}
        if isinstance(t, dict):
            task_name = t.get("task") or t.get("title") or t.get("content") or t.get("task_title") or ""
            return {
                "task": task_name.strip(),
                "instructions": (t.get("instructions") or "").strip()
            }
        return {"task": "", "instructions": ""}

    list_a = [normalize_task(t) for t in (tasks_a or [])]
    list_b = [normalize_task(t) for t in (tasks_b or [])]
    return list_a == list_b
