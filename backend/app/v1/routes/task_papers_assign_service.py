"""
Service layer for assigning test papers to candidates/jobs.

Extracted from the original `task_papers_assigned.py` route file to keep
route handlers thin. Contains the heavy business logic for the
`/assign` endpoint (predefined / random / custom / hybrid modes).
"""
from __future__ import annotations

import random
import logging
from typing import Any, Optional

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.models.question_set_paper import QuestionSetPaper
from app.v1.db.models.candidate_test_paper import CandidateTestPaper
from app.v1.db.models.candidate_test_paper_history import CandidateTestPaperHistory
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.job_stage_configs import JobStageConfig
from app.v1.db.models.stage_templates import StageTemplate
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.jobs import Job
from app.v1.schemas.task_papers import CandidateTestPaperAssign
from app.v1.schemas.user import UserRead
from app.v1.services.admin.candidate_task_service import candidate_task_service
from app.v1.utils.stage import get_question_round_filter
from app.v1.routes.task_papers_helpers import (
    get_candidate_active_job_id,
    get_candidate_active_stage_config_id,
    get_job_first_question_stage_config_id,
    parse_frontend_custom_task,
    auto_save_custom_items,
)

logger = logging.getLogger(__name__)


class TaskPaperAssignService:
    """Handles assignment of test papers (predefined/random/custom/hybrid)."""

    async def assign_test_paper(
        self,
        db: AsyncSession,
        assign_data: CandidateTestPaperAssign,
        user: UserRead,
    ) -> CandidateTestPaper:
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
            candidate_id, job_id, position_id, job, stage_config_id = (
                await self._resolve_candidate_context(db, assign_data)
            )
        else:
            job_id, position_id, job, stage_config_id = (
                await self._resolve_job_context(db, assign_data)
            )

        # Build the assigned content based on the requested mode
        assigned_name, assigned_questions, assigned_mcqs, assigned_task, assigned_file_path, assigned_skills = (
            await self._build_assigned_content(db, assign_data, job, position_id)
        )

        # Attach manual custom skills for Custom/Hybrid modes
        if assign_data.mode in ["custom", "hybrid"] and assign_data.custom_skills:
            assigned_skills = list(set((assigned_skills or []) + assign_data.custom_skills))

        # Auto-save custom items for custom/hybrid modes
        if assign_data.mode in ["custom", "hybrid"]:
            await auto_save_custom_items(
                questions=assign_data.questions or [],
                mcqs=assign_data.mcqs or [],
                tasks=assign_data.project_task or [],
                department_id=job.department_id,
                position_id=job.position_id,
                extracted_skills=assigned_skills,
                db=db,
            )

        # Normalize project_task into a list of dicts/strings and restore instructions
        assigned_task_list = await self._normalize_project_tasks(db, assigned_task)

        # Resolve guideline template content if guideline_id is provided, otherwise fall back to all guidelines
        guideline_content = None
        if assign_data.guideline_id:
            from app.v1.db.models.guidelines import Guideline
            guideline = await db.get(Guideline, assign_data.guideline_id)
            if guideline:
                guideline_content = guideline.content
        else:
            from app.v1.db.models.guidelines import Guideline
            res_all = await db.execute(select(Guideline.content).order_by(Guideline.created_at.asc()))
            guideline_contents = res_all.scalars().all()
            if guideline_contents:
                guideline_content = "\n\n".join(guideline_contents)

        # Persist the assigned test paper
        new_paper = await self._persist_paper(
            db,
            candidate_id=candidate_id,
            job_id=job_id,
            position_id=position_id,
            stage_config_id=stage_config_id,
            assigned_name=assigned_name,
            assigned_questions=assigned_questions,
            assigned_mcqs=assigned_mcqs,
            assigned_task_list=assigned_task_list,
            assigned_file_path=assigned_file_path,
            assigned_skills=assigned_skills,
            user=user,
            guideline_id=assign_data.guideline_id,
            guideline_content=guideline_content,
        )

        # Invalidate job cache immediately after assignment
        await self._invalidate_job_cache(job_id)

        return new_paper

    # ------------------------------------------------------------------
    # Context resolution
    # ------------------------------------------------------------------
    async def _resolve_candidate_context(
        self,
        db: AsyncSession,
        assign_data: CandidateTestPaperAssign,
    ) -> tuple:
        """Resolve candidate/job/position/stage for a candidate-level assignment."""
        candidate = await db.get(Candidate, assign_data.candidate_id)
        if not candidate:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Candidate with ID {assign_data.candidate_id} not found.",
            )

        candidate_id = candidate.id

        # Verify if Question/Practical Round is completed
        stmt_stage = (
            select(CandidateStage, StageTemplate.name)
            .join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
            .join(StageTemplate, JobStageConfig.template_id == StageTemplate.id)
            .where(
                CandidateStage.candidate_id == candidate_id,
                get_question_round_filter(JobStageConfig, StageTemplate),
            )
        )
        res_stage = await db.execute(stmt_stage)
        for s, stage_name in res_stage.all():
            if s.status == "completed":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot assign or modify test paper after the candidate has completed the {stage_name}.",
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

        stage_config_id = assign_data.job_stage_id or await get_candidate_active_stage_config_id(db, candidate_id)

        # Delete any existing test paper assignment for this candidate and stage config
        delete_stmt = delete(CandidateTestPaper).where(CandidateTestPaper.candidate_id == candidate_id)
        if stage_config_id:
            delete_stmt = delete_stmt.where(CandidateTestPaper.job_stage_config_id == stage_config_id)
        else:
            delete_stmt = delete_stmt.where(CandidateTestPaper.job_stage_config_id.is_(None))
        await db.execute(delete_stmt)
        await db.commit()

        return candidate_id, job_id, position_id, job, stage_config_id

    async def _resolve_job_context(
        self,
        db: AsyncSession,
        assign_data: CandidateTestPaperAssign,
    ) -> tuple:
        """Resolve job/position/stage for a job-level (public/common) assignment."""
        job_id = assign_data.job_id
        stmt_job = select(Job).options(selectinload(Job.skills)).where(Job.id == job_id)
        job = (await db.execute(stmt_job)).scalar_one_or_none()
        if not job or not job.position_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Job does not exist or does not have an experience level position configured.",
            )
        position_id = job.position_id

        # Auto-resolve the first question-type round's stage config if not explicitly provided.
        stage_config_id = assign_data.job_stage_id or await get_job_first_question_stage_config_id(db, job_id)

        # Delete any existing job-level default test paper for this stage config
        delete_stmt = delete(CandidateTestPaper).where(
            CandidateTestPaper.job_id == job_id,
            CandidateTestPaper.candidate_id.is_(None),
        )
        if stage_config_id:
            delete_stmt = delete_stmt.where(CandidateTestPaper.job_stage_config_id == stage_config_id)
        else:
            delete_stmt = delete_stmt.where(CandidateTestPaper.job_stage_config_id.is_(None))
        await db.execute(delete_stmt)
        await db.commit()

        return job_id, position_id, job, stage_config_id

    # ------------------------------------------------------------------
    # Content building per mode
    # ------------------------------------------------------------------
    async def _build_assigned_content(
        self,
        db: AsyncSession,
        assign_data: CandidateTestPaperAssign,
        job: Job,
        position_id,
    ) -> tuple:
        """Dispatch to the correct mode builder and return the assigned content tuple."""
        assigned_name = ""
        assigned_questions: list = []
        assigned_mcqs: list = []
        assigned_task = ""
        assigned_file_path: Optional[str] = None
        assigned_skills = None

        if assign_data.mode == "predefined":
            assigned_name, assigned_questions, assigned_mcqs, assigned_task, assigned_file_path, assigned_skills = (
                await self._build_predefined(db, assign_data)
            )
        elif assign_data.mode == "random":
            assigned_name, assigned_questions, assigned_mcqs, assigned_task, assigned_file_path, assigned_skills = (
                await self._build_random(db, assign_data, job, position_id)
            )
        elif assign_data.mode == "custom":
            assigned_name, assigned_questions, assigned_mcqs, assigned_task, assigned_file_path, assigned_skills = (
                await self._build_custom(db, assign_data)
            )
        elif assign_data.mode == "hybrid":
            assigned_name, assigned_questions, assigned_mcqs, assigned_task, assigned_file_path, assigned_skills = (
                await self._build_hybrid(db, assign_data)
            )

        return assigned_name, assigned_questions, assigned_mcqs, assigned_task, assigned_file_path, assigned_skills

    async def _build_predefined(self, db: AsyncSession, assign_data: CandidateTestPaperAssign) -> tuple:
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
        assigned_questions = (
            [q.model_dump(mode="json") if hasattr(q, "model_dump") else q for q in assign_data.questions]
            if assign_data.questions is not None
            else paper.questions
        )
        assigned_mcqs = (
            [m.model_dump(mode="json") if hasattr(m, "model_dump") else m for m in assign_data.mcqs]
            if assign_data.mcqs
            else paper.mcqs
        )
        assigned_task = (
            [t.model_dump(mode="json") if hasattr(t, "model_dump") else t for t in assign_data.project_task]
            if assign_data.project_task
            else paper.project_task
        )
        assigned_file_path = paper.task_file_path
        assigned_skills = paper.task_skills
        return assigned_name, assigned_questions, assigned_mcqs, assigned_task, assigned_file_path, assigned_skills

    async def _build_random(
        self,
        db: AsyncSession,
        assign_data: CandidateTestPaperAssign,
        job: Job,
        position_id,
    ) -> tuple:
        # Fetch all question set papers matching the candidate's job and position level
        stmt = select(QuestionSetPaper).options(selectinload(QuestionSetPaper.skills))
        if assign_data.source_paper_ids:
            stmt = stmt.where(QuestionSetPaper.id.in_(assign_data.source_paper_ids))
        else:
            job_skill_ids = [s.id for s in job.skills]
            stmt = stmt.where(
                QuestionSetPaper.department_id == job.department_id,
                QuestionSetPaper.position_id == position_id,
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

        # Fetch job_skill_weightages
        from sqlalchemy import text
        job_skills_query = text("SELECT skill_id, weightage FROM job_skills WHERE job_id = :job_id")
        job_skills_res = await db.execute(job_skills_query, {"job_id": job.id})
        skill_weights = {str(row[0]): float(row[1]) for row in job_skills_res.fetchall()}

        # Collect all questions and MCQs from matching papers, attaching weightage
        all_questions = []
        all_mcqs = []
        for p in papers:
            # Find max weightage for this paper based on its skills
            paper_skill_ids = [str(s.id) for s in p.skills]
            paper_weight = max([skill_weights.get(sid, 0.0) for sid in paper_skill_ids] + [0.0])

            if p.questions:
                for q in p.questions:
                    all_questions.append((q, paper_weight))
            if p.mcqs:
                for m in p.mcqs:
                    new_m = m.copy() if isinstance(m, dict) else getattr(m, "model_dump", lambda: m)()
                    all_mcqs.append((new_m, paper_weight))

        # Ensure unique questions and sort them by weightage descending
        seen_questions = set()
        unique_questions = []
        # Sort by weight descending, then random order
        random.shuffle(all_questions)
        all_questions.sort(key=lambda x: x[1], reverse=True)
        
        for q, w in all_questions:
            if isinstance(q, dict):
                q_text = q.get("question", "")
            elif hasattr(q, "question"):
                q_text = getattr(q, "question", "")
            else:
                q_text = str(q).strip()

            if q_text and q_text not in seen_questions:
                seen_questions.add(q_text)
                unique_questions.append(q)

        # De-duplicate MCQs by question text and sort by weightage descending
        seen_mcq_questions = set()
        unique_mcqs = []
        random.shuffle(all_mcqs)
        all_mcqs.sort(key=lambda x: x[1], reverse=True)

        for m, w in all_mcqs:
            q_text = m.get("question") if isinstance(m, dict) else getattr(m, "question", "")
            if q_text and q_text not in seen_mcq_questions:
                seen_mcq_questions.add(q_text)
                unique_mcqs.append(m)

        # Select one task randomly (associated file path comes from that same chosen paper)
        # We can also bias task selection by weightage, but random choice among highest weighted is best
        weighted_papers = []
        for p in papers:
            p_weight = max([skill_weights.get(str(s.id), 0.0) for s in p.skills] + [0.0])
            weighted_papers.append((p, p_weight))
        weighted_papers.sort(key=lambda x: x[1], reverse=True)
        
        # Pick top papers to randomly choose task from
        top_weight = weighted_papers[0][1] if weighted_papers else 0
        top_papers = [p for p, w in weighted_papers if w == top_weight]
        chosen_paper = random.choice(top_papers) if top_papers else random.choice(papers)
        
        assigned_task = chosen_paper.project_task if chosen_paper.project_task else []
        assigned_file_path = chosen_paper.task_file_path

        assigned_skills = None  # Will be extracted dynamically

        assigned_name = f"Randomized Test Paper ({job.title})"

        # Slice the top 10 since they are already sorted by weightage descending
        assigned_questions = unique_questions[:10]
        selected_mcqs = unique_mcqs[:10]
        assigned_mcqs = [m.model_dump(mode="json") if hasattr(m, "model_dump") else m for m in selected_mcqs]

        return assigned_name, assigned_questions, assigned_mcqs, assigned_task, assigned_file_path, assigned_skills

    async def _build_custom(self, db: AsyncSession, assign_data: CandidateTestPaperAssign) -> tuple:
        if not assign_data.questions and not assign_data.mcqs and not assign_data.project_task:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one of 'questions', 'mcqs', or 'project_task' is required when mode is 'custom'.",
            )

        assigned_name = "Custom Test Paper"
        assigned_questions = (
            [q.model_dump(mode="json") if hasattr(q, "model_dump") else q for q in assign_data.questions]
            if assign_data.questions
            else []
        )
        assigned_mcqs = (
            [m.model_dump(mode="json") if hasattr(m, "model_dump") else m for m in assign_data.mcqs]
            if assign_data.mcqs
            else []
        )
        assigned_task = (
            [t.model_dump(mode="json") if hasattr(t, "model_dump") else t for t in assign_data.project_task]
            if assign_data.project_task
            else []
        )
        assigned_file_path = None
        assigned_skills = None

        if assign_data.base_paper_id:
            base_paper = await db.get(QuestionSetPaper, assign_data.base_paper_id)
            if base_paper:
                assigned_task = assign_data.project_task or base_paper.project_task or []
                assigned_file_path = base_paper.task_file_path
                # assigned_skills will be extracted dynamically

        return assigned_name, assigned_questions, assigned_mcqs, assigned_task, assigned_file_path, assigned_skills

    async def _build_hybrid(self, db: AsyncSession, assign_data: CandidateTestPaperAssign) -> tuple:
        assigned_name = "Hybrid Custom Test Paper"
        final_questions = (
            [q.model_dump(mode="json") if hasattr(q, "model_dump") else q for q in assign_data.questions]
            if assign_data.questions
            else []
        )
        final_mcqs = (
            [m.model_dump(mode="json") if hasattr(m, "model_dump") else m for m in assign_data.mcqs]
            if assign_data.mcqs
            else []
        )
        final_tasks = (
            [
                t if isinstance(t, dict)
                else t.model_dump(mode="json") if hasattr(t, "model_dump")
                else {"task": str(t), "instructions": ""}
                for t in assign_data.project_task
            ]
            if assign_data.project_task
            else []
        )

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

        return assigned_name, final_questions, final_mcqs, final_tasks, assigned_file_path, assigned_skills

    # ------------------------------------------------------------------
    # Skill extraction & task normalization
    # ------------------------------------------------------------------
    async def _normalize_project_tasks(self, db: AsyncSession, assigned_task) -> list:
        """Ensure project_task is normalized to a list of dicts/strings, and restore instructions from predefined tasks bank."""
        assigned_task_list: list = []
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

        return assigned_task_list

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------
    async def _persist_paper(
        self,
        db: AsyncSession,
        *,
        candidate_id,
        job_id,
        position_id,
        stage_config_id,
        assigned_name,
        assigned_questions,
        assigned_mcqs,
        assigned_task_list,
        assigned_file_path,
        assigned_skills,
        user: UserRead,
        guideline_id=None,
        guideline_content=None,
    ) -> CandidateTestPaper:
        """Persist the assigned test paper (and history entry for candidate-level)."""
        new_paper = CandidateTestPaper(
            candidate_id=candidate_id,
            job_id=job_id,
            position_id=position_id,
            job_stage_config_id=stage_config_id,
            name=assigned_name,
            questions=assigned_questions,
            mcqs=assigned_mcqs,
            project_task=assigned_task_list,
            task_file_path=assigned_file_path,
            task_skills=assigned_skills,
            guideline_id=guideline_id,
            guideline_content=guideline_content,
        )
        db.add(new_paper)

        if candidate_id:
            history_entry = CandidateTestPaperHistory(
                candidate_id=candidate_id,
                job_id=job_id,
                job_stage_config_id=stage_config_id,
                name=assigned_name,
                questions=assigned_questions,
                mcqs=assigned_mcqs,
                project_task=assigned_task_list,
                task_file_path=assigned_file_path,
                task_skills=assigned_skills,
                user_id=user.id,
                guideline_id=guideline_id,
                guideline_content=guideline_content,
            )
            db.add(history_entry)

        await db.commit()
        await db.refresh(new_paper)
        return new_paper

    async def _invalidate_job_cache(self, job_id) -> None:
        """Best-effort job cache invalidation after assignment."""
        try:
            from app.v1.services.admin.system_service import system_service
            await system_service.invalidate_job_cache(job_id)
        except Exception:
            pass


task_paper_assign_service = TaskPaperAssignService()
