import json
import logging
import os
import uuid
from typing import Optional
import openai
from pathlib import Path
from fastapi import UploadFile, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.v1.core.config import settings
from app.v1.core.extractor import DocumentParser
from app.v1.core.storage import resolve_storage_path, to_storage_relative_path
from app.v1.db.models.candidates import Candidate

logger = logging.getLogger(__name__)

class CandidateTaskService:
    """Service to handle candidate-specific custom task files and skill extraction."""
    async def upload_and_extract_candidate_task_skills(self, db: AsyncSession, candidate_id: uuid.UUID, task_file: UploadFile) -> Candidate:
        # 1. Verify Candidate exists
        stmt = select(Candidate).where(Candidate.id == candidate_id)
        result = await db.execute(stmt)
        candidate = result.scalar_one_or_none()
        if not candidate:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Candidate not found.",
            )

        # 2. Save file
        file_extension = Path(task_file.filename).suffix.lower()
        if file_extension not in [".pdf", ".docx", ".doc"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format: {file_extension}. Only PDF, DOC, and DOCX are allowed.",
            )

        tasks_dir = resolve_storage_path(settings.TASK_UPLOAD_DIR)
        tasks_dir.mkdir(parents=True, exist_ok=True)
        file_name = f"candidate_task_{candidate_id}{file_extension}"
        target_path = tasks_dir / file_name
        stored_file_path = to_storage_relative_path(target_path)

        try:
            content = await task_file.read()
            target_path.write_bytes(content)
        except Exception as e:
            logger.error("Failed to save candidate task file: %s", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save the uploaded candidate task file.",
            )

        candidate.task_file_path = stored_file_path

        # 3. Extract Text and Skills
        raw_text = ""
        try:
            raw_text = DocumentParser().extract_text(target_path)
        except Exception as e:
            logger.error("Failed to parse candidate task file text: %s", e)
            
        if not raw_text.strip():
            logger.error("The candidate task document contains no readable text: %s", target_path)
            extracted_skills = []
        else:
            logger.info("Extracting skills from candidate task description using LLM in background...")
            extracted_skills = await self._extract_skills_from_text(raw_text)

        # 4. Update Candidate record in database
        try:
            candidate.task_skills = extracted_skills
            db.add(candidate)
            await db.commit()
            await db.refresh(candidate)
        except Exception as e:
            logger.error("Database update failed for candidate task details: %s", e)
            await db.rollback()

        # 5. Clear caches
        try:
            from app.v1.core.cache import cache
            await cache.clear(pattern="candidates:*")
        except Exception:
            pass

        return candidate
    async def _extract_skills_from_text(self, raw_text: str) -> list[str]:
        """Call LLM directly using openai client to extract a clean list of skills."""
        system_prompt = (
            "You are an expert technical recruiter and skill analyst.\n"
            "Your task is to analyze a candidate task/assignment description and extract all relevant technical, conceptual, and professional skills required to complete it.\n"
            "CRITICAL:\n"
            "1. You MUST output ONLY valid JSON format.\n"
            "2. Your output MUST be a JSON object with a single key 'skills' which is an array of strings representing the unique skill names.\n"
            "3. Do NOT include any conversational text, explanations, or markdown formatting (like ```json).\n"
            "4. Be precise and use standard technology/concept names (e.g. 'FastAPI', 'React', 'CSS', 'Database Design')."
        )
        
        user_prompt = f"""
Analyze the following candidate task description and extract the required skills:

TASK DESCRIPTION:
{raw_text[:8000]}

Output Format Example (JSON ONLY):
{{
  "skills": ["Skill1", "Skill2", "Skill3"]
}}
"""

        client = None
        try:
            base_url = settings.OLLAMA_URL
            if not base_url.endswith("/"):
                base_url += "/"
            if "/v1" not in base_url:
                base_url += "v1"

            client = openai.AsyncOpenAI(
                base_url=base_url,
                api_key=settings.OLLAMA_API_KEY or "ollama"
            )
            response = await client.chat.completions.create(
                model=settings.OLLAMA_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )

            response_text = response.choices[0].message.content or "{}"
            response_text = response_text.strip()
            
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            data = json.loads(response_text)
            skills = data.get("skills", [])
            
            cleaned_skills = sorted(list(set([str(skill).strip() for skill in skills if skill])))
            return cleaned_skills

        except Exception as e:
            logger.error("LLM candidate task skill extraction failed: %s", e)
            return []
        finally:
            if client:
                await client.close()

    async def extract_paper_details_from_text(self, raw_text: str, paper_type: str = "normal") -> dict:
        """Call LLM directly using openai client to extract questions, project task description, and technical skills."""
        if paper_type == "mixed":
            system_prompt = (
                "You are an expert technical recruiter and data extractor.\n"
                "Your task is to analyze a mixed document containing descriptive questions, multiple-choice questions (MCQs), and project tasks.\n"
                "Extract all of them carefully:\n"
                "1. Descriptive Questions: Extract verbatim into 'questions'.\n"
                "2. MCQs: Extract 'question', 'options', and 'answer' into 'mcqs'.\n"
                "3. Project Tasks: Extract instructions into 'project_task' as an array of objects. Each object must have:\n"
                "   - 'task': The main task title or short description.\n"
                "   - 'instructions': Detailed task instructions (string).\n"
                ""
                "4. Skills: Extract all required technical skills into 'skills'.\n"
                "CRITICAL RULES:\n"
                "1. You MUST output ONLY valid JSON format.\n"
                "2. Your output MUST be a JSON object with exactly four keys: 'questions', 'mcqs', 'project_task', and 'skills'.\n"
                "3. IMPORTANT FOR QUESTIONS: Extract questions VERBATIM. Do NOT rephrase them. Include any context.\n"
                "4. Do NOT include any conversational text, explanations, or markdown formatting outside the JSON."
            )
            user_prompt = f"""
Analyze the following mixed document and extract the questions, MCQs, project tasks, and skills:

DOCUMENT CONTENT:
{raw_text[:10000]}

Output Format Example (JSON ONLY):
{{
  "questions": ["Explain React Hooks."],
  "mcqs": [
    {{
      "question": "What is the output of print(type(1/2)) in Python 3?",
      "options": ["<class 'int'>", "<class 'float'>", "<class 'double'>", "<class 'number'>"],
      "answer": "<class 'float'>"
    }}
  ],
  "project_task": [
    {{
      "task": "Build a REST API",
      "instructions": "Use FastAPI with user authentication and JWT. Write unit tests."
    }}
  ],
  "skills": ["React", "FastAPI", "Python"]
}}
"""
        elif paper_type == "mcq":
            system_prompt = (
                "You are an expert technical recruiter and data extractor.\n"
                "Your task is to analyze a document containing multiple-choice questions (MCQs) and extract:\n"
                "1. All multiple choice questions found in the document. For each question, extract:\n"
                "   - 'question': the question text (verbatim)\n"
                "   - 'options': a list of strings representing the options/choices\n"
                "   - 'answer': the correct option or answer text\n"
                "2. All relevant technical skills required to answer the MCQs.\n"
                "CRITICAL RULES:\n"
                "1. You MUST output ONLY valid JSON format.\n"
                "2. Your output MUST be a JSON object with exactly four keys:\n"
                "   - 'questions': must be an empty list [].\n"
                "   - 'mcqs': an array of objects representing the MCQs, each having 'question', 'options', and 'answer' keys.\n"
                "   - 'project_task': must be an empty list [].\n"
                "   - 'skills': an array of strings representing unique technical skill names.\n"
                "3. Do NOT include any conversational text, explanations, or markdown formatting outside the JSON."
            )
            user_prompt = f"""
Analyze the following document and extract the MCQs and skills:

DOCUMENT CONTENT:
{raw_text[:10000]}

Output Format Example (JSON ONLY):
{{
  "questions": [],
  "mcqs": [
    {{
      "question": "What is the output of print(type(1/2)) in Python 3?",
      "options": ["<class 'int'>", "<class 'float'>", "<class 'double'>", "<class 'number'>"],
      "answer": "<class 'float'>"
    }}
  ],
  "project_task": [],
  "skills": ["Python"]
}}
"""
        elif paper_type == "task":
            system_prompt = (
                "You are an expert technical recruiter and data extractor.\n"
                "Your task is to analyze a project task/assignment description document and extract:\n"
                "1. The project task instructions/descriptions verbatim into 'project_task' as an array of objects. Each object must have:\n"
                "   - 'task': A string representing the main project task description or title.\n"
                "   - 'instructions': A string representing detailed instructions for the task.\n"
                "2. All relevant technical skills required to complete it.\n"
                "CRITICAL RULES:\n"
                "1. You MUST output ONLY valid JSON format.\n"
                "2. Your output MUST be a JSON object with exactly four keys:\n"
                "   - 'questions': must be an empty list [].\n"
                "   - 'mcqs': must be an empty list [].\n"
                "   - 'project_task': an array of structured objects.\n"
                "   - 'skills': an array of strings representing unique technical skill names.\n"
                "3. Do NOT include any conversational text, explanations, or markdown formatting outside the JSON."
            )
            user_prompt = f"""
Analyze the following task description and extract the project task details and skills:

TASK DESCRIPTION:
{raw_text[:10000]}

Output Format Example (JSON ONLY):
{{
  "questions": [],
  "mcqs": [],
  "project_task": [
    {{
      "task": "Build a REST API",
      "instructions": "Use FastAPI with user authentication and JWT. Write unit tests."
    }}
  ],
  "skills": ["FastAPI", "Python", "Unit Testing"]
}}
"""
        else:
            system_prompt = (
                "You are an expert technical recruiter and data extractor.\n"
                "Your task is to analyze a document containing descriptive/theory questions and extract:\n"
                "1. All descriptive technical interview questions found in the document exactly as written (verbatim).\n"
                "2. All relevant technical skills required to answer them.\n"
                "CRITICAL RULES:\n"
                "1. You MUST output ONLY valid JSON format.\n"
                "2. Your output MUST be a JSON object with exactly four keys:\n"
                "   - 'questions': an array of strings representing the questions.\n"
                "   - 'mcqs': must be an empty list [].\n"
                "   - 'project_task': must be an empty list [].\n"
                "   - 'skills': an array of strings representing unique technical skill names.\n"
                "3. IMPORTANT FOR QUESTIONS: Extract the questions VERBATIM. Do NOT rephrase them. "
                "If a question is preceded by a Problem Statement, Table Structure, Sample Data, Code, or any other context, "
                "you MUST include all of that context and markdown tables as part of the question string.\n"
                "4. Do NOT include any conversational text, explanations, or markdown formatting outside the JSON."
            )
            user_prompt = f"""
Analyze the following document and extract the questions and skills:

DOCUMENT CONTENT:
{raw_text[:10000]}

Output Format Example (JSON ONLY):
{{
  "questions": [
    "Explain the difference between deep copy and shallow copy in Python.",
    "**Problem Statement:**\\nWrite a function to...\\n\\nQuestion: How would you optimize this?"
  ],
  "mcqs": [],
  "project_task": [],
  "skills": ["Python"]
}}
"""

        client = None
        try:
            base_url = settings.OLLAMA_URL
            if not base_url.endswith("/"):
                base_url += "/"
            if "/v1" not in base_url:
                base_url += "v1"

            client = openai.AsyncOpenAI(
                base_url=base_url,
                api_key=settings.OLLAMA_API_KEY or "ollama"
            )
            response = await client.chat.completions.create(
                model=settings.OLLAMA_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )

            response_text = response.choices[0].message.content or "{}"
            response_text = response_text.strip()
            
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            data = json.loads(response_text)
            questions = data.get("questions", [])
            if not isinstance(questions, list):
                questions = []
            
            mcqs = data.get("mcqs", [])
            if not isinstance(mcqs, list):
                mcqs = []
            
            project_task = data.get("project_task", [])
            if not isinstance(project_task, list):
                project_task = [str(project_task)] if project_task else []
                
            skills = data.get("skills", [])
            if not isinstance(skills, list):
                skills = []
            
            cleaned_skills = sorted(list(set([str(skill).strip() for skill in skills if skill])))
            
            return {
                "questions": questions,
                "mcqs": mcqs,
                "project_task": project_task,
                "skills": cleaned_skills
            }

        except Exception as e:
            logger.error("LLM task paper details extraction failed: %s", e)
            return {
                "questions": [],
                "mcqs": [],
                "project_task": [],
                "skills": []
            }
        finally:
            if client:
                await client.close()

    async def _get_active_stage_config_id(self, db: AsyncSession, candidate_id: uuid.UUID) -> Optional[uuid.UUID]:
        from app.v1.db.models.candidate_stages import CandidateStage
        from app.v1.db.models.job_stage_configs import JobStageConfig
        from app.v1.db.models.stage_templates import StageTemplate
        from app.v1.utils.stage import get_question_round_filter
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

    async def get_candidate_task_skills(self, db: AsyncSession, candidate_id: uuid.UUID) -> dict:
        # 1. Verify Candidate exists
        stmt = select(Candidate).options(selectinload(Candidate.applied_job)).where(Candidate.id == candidate_id)
        result = await db.execute(stmt)
        candidate = result.scalar_one_or_none()
        if not candidate:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Candidate not found.",
            )
            
        task_file_path = candidate.task_file_path
        task_skills = candidate.task_skills
        is_custom_task = False

        if not task_file_path:
            active_stage_id = await self._get_active_stage_config_id(db, candidate_id)
            from app.v1.db.models.candidate_test_paper import CandidateTestPaper
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
            
            if not test_paper and candidate.applied_job_id:
                stmt_job = select(CandidateTestPaper).where(
                    CandidateTestPaper.job_id == candidate.applied_job_id,
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
                    stmt_job = stmt_job.where(CandidateTestPaper.job_stage_config_id.is_(None))
                    res_job = await db.execute(stmt_job)
                    test_paper = res_job.scalar_one_or_none()
            
            if test_paper:
                task_file_path = test_paper.task_file_path
                task_skills = test_paper.task_skills
                is_custom_task = True if task_file_path else False
            elif candidate.applied_job:
                task_file_path = candidate.applied_job.task_file_path
                task_skills = candidate.applied_job.task_skills
        else:
            is_custom_task = True if task_file_path else False

        return {
            "task_file_path": task_file_path,
            "task_skills": task_skills,
            "is_custom_task": is_custom_task
        }

    async def get_candidate_and_job_skills(
        self, db: AsyncSession, candidate_id: uuid.UUID, job_id: uuid.UUID
    ) -> dict:
        """Fetch standard job skills and custom candidate task skills (with default job task fallback)."""
        # 1. Fetch Candidate
        candidate_stmt = select(Candidate).where(Candidate.id == candidate_id)
        candidate_result = await db.execute(candidate_stmt)
        candidate = candidate_result.scalar_one_or_none()
        if not candidate:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Candidate not found.",
            )

        # 2. Fetch Job with its standard skills
        from app.v1.db.models.jobs import Job
        job_stmt = select(Job).options(selectinload(Job.skills)).where(Job.id == job_id)
        job_result = await db.execute(job_stmt)
        job = job_result.scalar_one_or_none()
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found.",
            )

        # 3. Retrieve Job standard skills (names only)
        job_skills = [skill.name for skill in job.skills] if job.skills else []

        # 4. Fallback logic for candidate task skills
        task_skills = candidate.task_skills
        if not candidate.task_file_path:
            active_stage_id = await self._get_active_stage_config_id(db, candidate_id)
            from app.v1.db.models.candidate_test_paper import CandidateTestPaper
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
            
            if not test_paper and candidate.applied_job_id:
                stmt_job = select(CandidateTestPaper).where(
                    CandidateTestPaper.job_id == candidate.applied_job_id,
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
                    stmt_job = stmt_job.where(CandidateTestPaper.job_stage_config_id.is_(None))
                    res_job = await db.execute(stmt_job)
                    test_paper = res_job.scalar_one_or_none()
                
            if test_paper:
                task_skills = test_paper.task_skills or []
            else:
                # Fallback to job default task skills
                task_skills = job.task_skills or []
        else:
            task_skills = task_skills or []

        return {
            "job_skills": job_skills,
            "task_skills": task_skills
        }

    async def delete_candidate_task_skills(self, db: AsyncSession, candidate_id: uuid.UUID) -> None:
        """Delete candidate-specific task details and revert to default."""
        # 1. Fetch Candidate
        stmt = select(Candidate).where(Candidate.id == candidate_id)
        result = await db.execute(stmt)
        candidate = result.scalar_one_or_none()
        if not candidate:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Candidate not found.",
            )

        # 2. Delete the physical task file if it exists
        if candidate.task_file_path:
            try:
                abs_path = resolve_storage_path(candidate.task_file_path)
                if abs_path.is_file():
                    abs_path.unlink()
            except Exception as e:
                logger.error("Failed to delete physical custom task file: %s", e)

        # 3. Clear fields in candidate record
        candidate.task_file_path = None
        candidate.task_skills = None
        
        try:
            db.add(candidate)
            await db.commit()
        except Exception as e:
            logger.error("Failed to update candidate record after custom task deletion: %s", e)
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete candidate task details from database."
            )

        # 4. Clear candidate cache
        try:
            from app.v1.core.cache import cache
            await cache.clear(pattern="candidates:*")
            if candidate.applied_job_id:
                from app.v1.services.admin.system_service import system_service
                await system_service.invalidate_job_cache(candidate.applied_job_id)
        except Exception:
            pass

    async def generate_random_paper_for_job(
        self,
        db: AsyncSession,
        job,
        candidate_id: uuid.UUID | None = None,
        job_stage_config_id: uuid.UUID | None = None
    ):
        """Generates a random CandidateTestPaper from bank matching job's dept/pos/skills.
        Returns the CandidateTestPaper instance without committing to DB, or None if no matching questions.
        """
        import random
        from app.v1.db.models.skills import Skill
        from app.v1.db.models.question_set_paper import QuestionSetPaper
        from app.v1.db.models.candidate_test_paper import CandidateTestPaper
        
        stmt = select(QuestionSetPaper).options(selectinload(QuestionSetPaper.skills))
        
        job_skill_ids = [s.id for s in job.skills] if job.skills else []
        stmt = stmt.where(
            QuestionSetPaper.department_id == job.department_id,
            QuestionSetPaper.position_id == job.position_id
        )
        if job_skill_ids:
            stmt = stmt.where(QuestionSetPaper.skills.any(Skill.id.in_(job_skill_ids)))
        else:
            return None
            
        res = await db.execute(stmt)
        papers = res.scalars().all()

        if not papers:
            return None

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
            q_text = q.get("question") if isinstance(q, dict) else getattr(q, "question", "")
            if q_text and q_text not in seen_questions:
                seen_questions.add(q_text)
                if isinstance(q, str):
                    unique_questions.append({"question": q, "marks": 5, "duration": 3})
                else:
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

        # Select one task randomly (biased by weightage if we wanted, but let's just pick one)
        papers_with_tasks = [p for p in papers if p.project_task and len(p.project_task) > 0]
        if papers_with_tasks:
            chosen_task_paper = random.choice(papers_with_tasks)
            assigned_task = chosen_task_paper.project_task
            assigned_file_path = chosen_task_paper.task_file_path
        else:
            assigned_task = []
            assigned_file_path = None
        
        assigned_name = f"Randomized Test Paper ({job.title})"

        # Slice the top 10 since they are already sorted by weightage descending
        assigned_questions = unique_questions[:10]
        
        if unique_mcqs:
            selected_mcqs = unique_mcqs[:10]
            assigned_mcqs = [m.model_dump() if hasattr(m, "model_dump") else m for m in selected_mcqs]
        else:
            assigned_mcqs = []

        new_paper = CandidateTestPaper(
            job_id=job.id,
            candidate_id=candidate_id,
            position_id=job.position_id,
            job_stage_config_id=job_stage_config_id,
            name=assigned_name,
            questions=assigned_questions,
            mcqs=assigned_mcqs,
            project_task=assigned_task,
            task_file_path=assigned_file_path,
            task_skills=None
        )
        
        return new_paper

candidate_task_service = CandidateTaskService()
