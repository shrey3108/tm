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
            CandidateStage.status.in_(["active", "processing", "queued", "submitted", "completed"]),
            get_question_round_filter(JobStageConfig, StageTemplate)
        )
        .order_by(JobStageConfig.stage_order.desc())
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
    db: AsyncSession,
    extracted_skills: list[str] = None
):
    if not department_id or not position_id:
        return
    if not questions and not mcqs and not tasks:
        return

    from sqlalchemy.orm import selectinload
    stmt = select(QuestionSetPaper).options(selectinload(QuestionSetPaper.skills)).where(
        QuestionSetPaper.department_id == department_id,
        QuestionSetPaper.position_id == position_id,
        QuestionSetPaper.name == "Auto-Saved Custom Questions"
    )
    res = await db.execute(stmt)
    auto_paper = res.scalars().first()
    
    # Pre-fetch all skills referenced in the incoming items
    from app.v1.db.models.skills import Skill
    collected_skill_ids = set()
    for items_list in [questions, mcqs, tasks]:
        if items_list:
            for item in items_list:
                if isinstance(item, dict) and item.get("skill_ids"):
                    collected_skill_ids.update(item["skill_ids"])
                elif hasattr(item, "skill_ids") and getattr(item, "skill_ids"):
                    collected_skill_ids.update(item.skill_ids)

    fetched_skills_map = {}
    if collected_skill_ids:
        stmt_skills = select(Skill).where(Skill.id.in_(list(collected_skill_ids)))
        res_skills = await db.execute(stmt_skills)
        for s in res_skills.scalars().all():
            fetched_skills_map[str(s.id)] = s

    def get_skills_for_item(item):
        s_ids = item.get("skill_ids") if isinstance(item, dict) else getattr(item, "skill_ids", None)
        if not s_ids: return []
        return [fetched_skills_map[str(sid)] for sid in s_ids if str(sid) in fetched_skills_map]

    needs_save = False
    
    new_q = list(auto_paper.questions) if auto_paper and auto_paper.questions else []
    new_m = list(auto_paper.mcqs) if auto_paper and auto_paper.mcqs else []
    new_t = list(auto_paper.project_task) if auto_paper and auto_paper.project_task else []

    if questions:
        for q in questions:
            q_skills = get_skills_for_item(q)
            if not await handle_duplicate_question(q, department_id, position_id, q_skills, db):
                new_q.append(q if isinstance(q, dict) else q.model_dump(mode="json") if hasattr(q, "model_dump") else q)
                needs_save = True

    if mcqs:
        for m in mcqs:
            m_skills = get_skills_for_item(m)
            if not await handle_duplicate_mcq(m, department_id, position_id, m_skills, db):
                new_m.append(m if isinstance(m, dict) else m.model_dump(mode="json") if hasattr(m, "model_dump") else m)
                needs_save = True
                
    if tasks:
        for t in tasks:
            t_skills = get_skills_for_item(t)
            if not await handle_duplicate_task(t, department_id, position_id, t_skills, db):
                new_t.append(t if isinstance(t, dict) else t.model_dump(mode="json") if hasattr(t, "model_dump") else t)
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
        
        # Append to auto_paper if not already present
        if fetched_skills_map:
            current_skill_ids = {str(s.id) for s in auto_paper.skills} if auto_paper.skills else set()
            for skill in fetched_skills_map.values():
                if str(skill.id) not in current_skill_ids:
                    auto_paper.skills.append(skill)
                    current_skill_ids.add(str(skill.id))

        # 2. Append extracted skills (if any were passed as names)
        if extracted_skills:
            from sqlalchemy import func
            existing_skills_stmt = select(Skill).where(
                func.lower(Skill.name).in_([s.lower() for s in extracted_skills])
            )
            res_skills = await db.execute(existing_skills_stmt)
            existing_skills = res_skills.scalars().all()
            existing_skill_names = {s.name.lower(): s for s in existing_skills}
            
            for s_name in extracted_skills:
                s_name_lower = s_name.lower()
                if s_name_lower not in existing_skill_names:
                    new_skill = Skill(name=s_name, description=f"Auto-extracted skill: {s_name}")
                    db.add(new_skill)
                    existing_skills.append(new_skill)
            
            # Avoid duplicating skills that are already attached to auto_paper
            current_skill_ids = {str(s.id) for s in auto_paper.skills} if auto_paper.skills else set()
            for skill in existing_skills:
                if str(skill.id) not in current_skill_ids and skill.id is not None:
                    auto_paper.skills.append(skill)
                elif skill.id is None: # newly added
                    auto_paper.skills.append(skill)

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
