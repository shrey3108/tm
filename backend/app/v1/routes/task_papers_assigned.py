import os
import uuid
import random
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.session import get_db
from app.v1.dependencies import check_permission
from app.v1.db.models.question_set_paper import QuestionSetPaper
from app.v1.db.models.candidate_test_paper import CandidateTestPaper
from app.v1.db.models.candidate_test_paper_history import CandidateTestPaperHistory
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.job_stage_configs import JobStageConfig
from app.v1.db.models.stage_templates import StageTemplate
from app.v1.utils.pdf_generator import generate_candidate_task_pdf_file
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.jobs import Job
from app.v1.db.models.job_positions import JobPosition
from app.v1.schemas.task_papers import CandidateTestPaperRead, CandidateTestPaperAssign, TaskPaperPreviewResponse
from app.v1.schemas.user import UserRead
from app.v1.schemas.upload import CandidateTaskRead, JobCandidateSkillsRead
from app.v1.services.admin.candidate_task_service import candidate_task_service
from app.v1.routes.task_papers_predefined import handle_duplicate_question, handle_duplicate_mcq, handle_duplicate_task
from app.v1.utils.uuid import UUIDHelper

router = APIRouter()


async def get_candidate_active_job_id(db: AsyncSession, candidate: Candidate) -> Optional[uuid.UUID]:
    """Resolve the candidate's active job ID.
    Looks up CandidateStage for an active Technical Practical Round stage.
    Falls back to candidate.applied_job_id if no active stage exists.
    """
    stmt = (
        select(JobStageConfig.job_id)
        .join(CandidateStage, CandidateStage.job_stage_id == JobStageConfig.id)
        .join(StageTemplate, JobStageConfig.template_id == StageTemplate.id)
        .where(
            CandidateStage.candidate_id == candidate.id,
            CandidateStage.status == "active",
            StageTemplate.name == "Technical Practical Round"
        )
        .limit(1)
    )
    res = await db.execute(stmt)
    active_job_id = res.scalar_one_or_none()
    if active_job_id:
        return active_job_id
    return candidate.applied_job_id


def parse_frontend_custom_task(text: str) -> tuple[str, str] | None:
    if not text:
        return None
    import re
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

        # Verify if Technical Practical Round is completed
        stmt_stage = (
            select(CandidateStage)
            .join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
            .join(StageTemplate, JobStageConfig.template_id == StageTemplate.id)
            .where(
                CandidateStage.candidate_id == candidate_id,
                StageTemplate.name == "Technical Practical Round"
            )
        )
        res_stage = await db.execute(stmt_stage)
        stages = res_stage.scalars().all()
        if any(s.status == "completed" for s in stages):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot assign or modify test paper after the candidate has completed the Technical Practical Round.",
            )

        job_id = await get_candidate_active_job_id(db, candidate)
        if not job_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Candidate does not have an associated job.",
            )

        # Fetch candidate's job position level
        stmt_job = select(Job).options(selectinload(Job.skills)).where(Job.id == job_id)
        job = (await db.execute(stmt_job)).scalar_one_or_none()
        if not job or not job.position_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Candidate's job does not have an experience level position configured.",
            )

        position_id = job.position_id

        # Delete any existing test paper assignment for this candidate to prevent unique constraint conflicts
        await db.execute(
            delete(CandidateTestPaper).where(CandidateTestPaper.candidate_id == candidate_id)
        )
        await db.commit()
    else:
        # Assign at Job level (public/common test paper for this job)
        job_id = assign_data.job_id
        stmt_job = select(Job).options(selectinload(Job.skills)).where(Job.id == job_id)
        job = (await db.execute(stmt_job)).scalar_one_or_none()
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
    assigned_mcqs = []
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

        assigned_name = paper.name
        # Allow overriding template questions/tasks manually
        assigned_questions = [q.model_dump() if hasattr(q, "model_dump") else q for q in assign_data.questions] if assign_data.questions is not None else paper.questions
        assigned_mcqs = [m.model_dump() if hasattr(m, "model_dump") else m for m in assign_data.mcqs] if assign_data.mcqs is not None else paper.mcqs
        assigned_task = [t.model_dump() if hasattr(t, "model_dump") else t for t in assign_data.project_task] if assign_data.project_task is not None else paper.project_task
        assigned_file_path = paper.task_file_path
        assigned_skills = paper.task_skills

    elif assign_data.mode == "random":
        # Fetch all question set papers matching the candidate's job and position level
        stmt = select(QuestionSetPaper).options(selectinload(QuestionSetPaper.skills))
        if assign_data.source_paper_ids:
            stmt = stmt.where(QuestionSetPaper.id.in_(assign_data.source_paper_ids))
        else:
            job_skill_ids = [s.id for s in job.skills]
            stmt = stmt.where(
                QuestionSetPaper.department_id == job.department_id,
                QuestionSetPaper.position_id == position_id
            )
            if job_skill_ids:
                from app.v1.db.models.skills import Skill
                stmt = stmt.where(QuestionSetPaper.skills.any(Skill.id.in_(job_skill_ids)))
            else:
                stmt = stmt.where(False)
        res = await db.execute(stmt)
        papers = res.scalars().all()

        if not papers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No question set papers available for this job and experience level to generate a random test.",
            )

        # Collect all questions and MCQs from matching papers
        all_questions = []
        all_mcqs = []
        for p in papers:
            if p.questions:
                all_questions.extend(p.questions)
            if p.mcqs:
                for m in p.mcqs:
                    new_m = m.copy() if isinstance(m, dict) else getattr(m, "model_dump", lambda: m)()
                    all_mcqs.append(new_m)

        # Ensure we have at least 5 unique questions or fallback to total pool
        unique_questions = list(set(all_questions))
        if len(unique_questions) < 5:
            unique_questions = all_questions

        # De-duplicate MCQs by question text
        seen_mcq_questions = set()
        unique_mcqs = []
        for m in all_mcqs:
            q_text = m.get("question") if isinstance(m, dict) else getattr(m, "question", "")
            if q_text and q_text not in seen_mcq_questions:
                seen_mcq_questions.add(q_text)
                unique_mcqs.append(m)

        # Select one task randomly (associated file path comes from that same chosen paper)
        chosen_paper = random.choice(papers)
        assigned_task = chosen_paper.project_task if chosen_paper.project_task else []
        assigned_file_path = chosen_paper.task_file_path
        
        assigned_skills = None  # Will be extracted dynamically
        
        assigned_name = f"Randomized Test Paper ({job.title})"

        if unique_questions:
            assigned_questions = random.sample(unique_questions, min(10, len(unique_questions)))
        else:
            assigned_questions = []

        if unique_mcqs:
            selected_mcqs = random.sample(unique_mcqs, min(10, len(unique_mcqs)))
            assigned_mcqs = [m.model_dump() if hasattr(m, "model_dump") else m for m in selected_mcqs]
        else:
            assigned_mcqs = []

    elif assign_data.mode == "custom":
        if not assign_data.questions and not assign_data.mcqs and not assign_data.project_task:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one of 'questions', 'mcqs', or 'project_task' is required when mode is 'custom'.",
            )

        assigned_name = "Custom Test Paper"
        assigned_questions = [q.model_dump() if hasattr(q, "model_dump") else q for q in assign_data.questions] if assign_data.questions else []
        assigned_mcqs = [m.model_dump() if hasattr(m, "model_dump") else m for m in assign_data.mcqs] if assign_data.mcqs else []
        assigned_task = [t.model_dump() if hasattr(t, "model_dump") else t for t in assign_data.project_task] if assign_data.project_task else []
        assigned_file_path = None
        assigned_skills = None

        if assign_data.base_paper_id:
            base_paper = await db.get(QuestionSetPaper, assign_data.base_paper_id)
            if base_paper:
                assigned_task = assign_data.project_task or base_paper.project_task or []
                assigned_file_path = base_paper.task_file_path
                # assigned_skills will be extracted dynamically

    elif assign_data.mode == "hybrid":
        assigned_name = "Hybrid Custom Test Paper"
        final_questions = [q.model_dump() if hasattr(q, "model_dump") else q for q in assign_data.questions] if assign_data.questions else []
        final_mcqs = [m.model_dump() if hasattr(m, "model_dump") else m for m in assign_data.mcqs] if assign_data.mcqs else []
        final_tasks = [t if isinstance(t, dict) else t.model_dump() if hasattr(t, "model_dump") else {"task": str(t), "instructions": ""} for t in assign_data.project_task] if assign_data.project_task else []
        
        assigned_file_path = None
        assigned_skills = None

        if getattr(assign_data, "source_mix", None):
            for mix_item in assign_data.source_mix:
                source_paper = await db.get(QuestionSetPaper, mix_item.paper_id)
                if not source_paper:
                    continue
                
                if not assigned_file_path and source_paper.task_file_path:
                    assigned_file_path = source_paper.task_file_path
                
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

        assigned_questions = final_questions
        assigned_mcqs = final_mcqs
        assigned_task = final_tasks

    if assign_data.mode in ["custom", "hybrid"]:
        await auto_save_custom_items(
            questions=assign_data.questions or [],
            mcqs=assign_data.mcqs or [],
            tasks=assign_data.project_task or [],
            department_id=job.department_id,
            position_id=job.position_id,
            db=db
        )

    # Dynamic skill extraction for Random and Custom modes to ensure exact skill matching
    if assign_data.mode in ["random", "custom", "hybrid"]:
        raw_text_parts = []
        if assigned_questions:
            for q in assigned_questions:
                q_text = q.get("question") if isinstance(q, dict) else getattr(q, "question", str(q))
                if q_text:
                    raw_text_parts.append(q_text)
        if assigned_mcqs:
            for m in assigned_mcqs:
                q_text = m.get("question") if isinstance(m, dict) else getattr(m, "question", "")
                if q_text:
                    raw_text_parts.append(q_text)
        if assigned_task:
            if isinstance(assigned_task, list):
                for t in assigned_task:
                    if isinstance(t, str):
                        raw_text_parts.append(t)
                    elif isinstance(t, dict):
                        task_name = t.get("task", t.get("title", t.get("content", "")))
                        instructions = t.get("instructions", "")
                        raw_text_parts.append(f"{task_name} {instructions}")
            else:
                raw_text_parts.append(str(assigned_task))
        
        if raw_text_parts:
            raw_text = "\n\n".join(raw_text_parts)
            try:
                extracted = await candidate_task_service._extract_skills_from_text(raw_text)
                if extracted:
                    assigned_skills = extracted
            except Exception as e:
                import logging
                logging.getLogger(__name__).error("Dynamic skill extraction failed during assignment: %s", e)

    # Ensure project_task is normalized to a list of dicts/strings, and restore instructions from predefined tasks bank.
    assigned_task_list = []
    if assigned_task:
        import re
        if isinstance(assigned_task, list):
            for item in assigned_task:
                if isinstance(item, str):
                    if "---" in item:
                        parts = [p.strip() for p in re.split(r'\s*---\s*', item) if p.strip()]
                        assigned_task_list.extend(parts)
                    else:
                        assigned_task_list.append(item)
                else:
                    assigned_task_list.append(item)
        elif isinstance(assigned_task, str):
            if "---" in assigned_task:
                parts = [p.strip() for p in re.split(r'\s*---\s*', assigned_task) if p.strip()]
                assigned_task_list.extend(parts)
            else:
                assigned_task_list = [assigned_task] if assigned_task.strip() else []

    # Reconstruct instructions for project tasks if missing
    if assigned_task_list:
        stmt_papers = select(QuestionSetPaper.project_task)
        res_papers = await db.execute(stmt_papers)
        all_db_tasks = res_papers.scalars().all()
        
        task_instruction_map = {}
        for db_task_list in all_db_tasks:
            if not db_task_list:
                continue
            for t in db_task_list:
                if isinstance(t, dict):
                    task_name = t.get("task") or t.get("title") or t.get("content") or t.get("task_title")
                    instructions = t.get("instructions")
                    if task_name and instructions:
                        normalized_key = " ".join(task_name.strip().split())
                        task_instruction_map[normalized_key] = instructions
        
        normalized_task_list = []
        for item in assigned_task_list:
            if isinstance(item, str):
                task_str = item.strip()
                parsed = parse_frontend_custom_task(task_str)
                if parsed:
                    task_name, instructions = parsed
                    normalized_task_list.append({"task": task_name, "instructions": instructions})
                else:
                    lookup_key = " ".join(task_str.split())
                    instructions = task_instruction_map.get(lookup_key, "")
                    normalized_task_list.append({"task": task_str, "instructions": instructions})
            elif isinstance(item, dict):
                task_name = item.get("task") or item.get("title") or item.get("content") or item.get("task_title") or "Untitled Task"
                task_str = task_name.strip()
                parsed = parse_frontend_custom_task(task_str)
                new_item = dict(item)
                if parsed:
                    task_name_clean, instructions = parsed
                    new_item["task"] = task_name_clean
                    new_item["instructions"] = instructions
                    normalized_task_list.append(new_item)
                else:
                    lookup_key = " ".join(task_str.split())
                    instructions = item.get("instructions") or task_instruction_map.get(lookup_key, "")
                    new_item["task"] = task_str
                    new_item["instructions"] = instructions
                    normalized_task_list.append(new_item)
            else:
                normalized_task_list.append(item)
        assigned_task_list = normalized_task_list

    # Persist the assigned test paper
    new_paper = CandidateTestPaper(
        candidate_id=candidate_id,
        job_id=job_id,
        position_id=position_id,
        name=assigned_name,
        questions=assigned_questions,
        mcqs=assigned_mcqs,
        project_task=assigned_task_list,
        task_file_path=assigned_file_path,
        task_skills=assigned_skills,
    )
    db.add(new_paper)

    if candidate_id:
        history_entry = CandidateTestPaperHistory(
            candidate_id=candidate_id,
            job_id=job_id,
            name=assigned_name,
            questions=assigned_questions,
            mcqs=assigned_mcqs,
            project_task=assigned_task_list,
            task_file_path=assigned_file_path,
            task_skills=assigned_skills,
            user_id=user.id,
        )
        db.add(history_entry)

    await db.commit()
    await db.refresh(new_paper)

    # Invalidate job cache immediately after assignment
    try:
        from app.v1.services.admin.system_service import system_service
        await system_service.invalidate_job_cache(job_id)
    except Exception:
        pass

    return new_paper


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

    is_candidate_specific = (paper is not None)

    if not paper:
        # Check if candidate has reached the Technical Practical Round before falling back
        stmt_stage = (
            select(CandidateStage)
            .join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
            .join(StageTemplate, JobStageConfig.template_id == StageTemplate.id)
            .where(
                CandidateStage.candidate_id == candidate_id,
                StageTemplate.name == "Technical Practical Round",
                CandidateStage.status.in_(["active", "completed"])
            )
        )
        res_stage = await db.execute(stmt_stage)
        stages = res_stage.scalars().all()
        if not stages:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No test paper assigned. Candidate has not reached the Technical Practical Round yet.",
            )

        # Fallback to job-level default test paper!
        candidate = await db.get(Candidate, candidate_id)
        if candidate:
            job_id = await get_candidate_active_job_id(db, candidate)
            if job_id:
                stmt_job = select(CandidateTestPaper).where(
                    CandidateTestPaper.job_id == job_id,
                    CandidateTestPaper.candidate_id.is_(None)
                ).order_by(CandidateTestPaper.created_at.desc())
                res_job = await db.execute(stmt_job)
                paper = res_job.scalars().first()

    if not paper:
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
                ).order_by(CandidateTestPaper.created_at.desc())
                res_job = await db.execute(stmt_job)
                job_paper = res_job.scalars().first()
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
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:decide")),
):
    """Unassign/delete the candidate's test paper."""
    # Verify if Technical Practical Round is completed
    stmt_stage = (
        select(CandidateStage)
        .join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
        .join(StageTemplate, JobStageConfig.template_id == StageTemplate.id)
        .where(
            CandidateStage.candidate_id == candidate_id,
            StageTemplate.name == "Technical Practical Round"
        )
    )
    res_stage = await db.execute(stmt_stage)
    stages = res_stage.scalars().all()
    if any(s.status == "completed" for s in stages):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot assign or modify test paper after the candidate has completed the Technical Practical Round.",
        )

    stmt = select(CandidateTestPaper).where(CandidateTestPaper.candidate_id == candidate_id)
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
    db: AsyncSession = Depends(get_db),
    user: UserRead = Depends(check_permission("candidates:access")),
):
    """Retrieve the default common test paper assigned to the job (where candidate_id is null)."""
    stmt = select(CandidateTestPaper).where(
        CandidateTestPaper.job_id == job_id,
        CandidateTestPaper.candidate_id.is_(None)
    ).order_by(CandidateTestPaper.created_at.desc())
    res = await db.execute(stmt)
    paper = res.scalars().first()

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
    papers = res.scalars().all()
    if not papers:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No default test paper assigned to this job.",
        )
    for paper in papers:
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
    stmt_paper = select(CandidateTestPaper).where(CandidateTestPaper.candidate_id == candidate_id)
    res_paper = await db.execute(stmt_paper)
    test_paper = res_paper.scalar_one_or_none()

    if not test_paper:
        # Check if candidate has reached the Technical Practical Round before falling back
        stmt_stage = (
            select(CandidateStage)
            .join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
            .join(StageTemplate, JobStageConfig.template_id == StageTemplate.id)
            .where(
                CandidateStage.candidate_id == candidate_id,
                StageTemplate.name == "Technical Practical Round",
                CandidateStage.status.in_(["active", "completed"])
            )
        )

        res_stage = await db.execute(stmt_stage)
        stages = res_stage.scalars().all()
        if not stages:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No test paper assigned. Candidate has not reached the Technical Practical Round yet.",
            )

        candidate = await db.get(Candidate, candidate_id)
        if candidate:
            job_id = await get_candidate_active_job_id(db, candidate)
            if job_id:
                stmt_job = select(CandidateTestPaper).where(
                    CandidateTestPaper.job_id == job_id,
                    CandidateTestPaper.candidate_id.is_(None)
                ).order_by(CandidateTestPaper.created_at.desc())
                res_job = await db.execute(stmt_job)
                test_paper = res_job.scalars().first()

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
