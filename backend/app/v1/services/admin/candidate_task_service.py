import json
import logging
import os
import uuid
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
                temperature=0.0
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

    async def extract_paper_details_from_text(self, raw_text: str) -> dict:
        """Call LLM directly using openai client to extract questions, project task description, and technical skills."""
        system_prompt = (
            "You are an expert technical recruiter, questions designer, and skill analyst.\n"
            "Your task is to analyze a candidate task/assignment description and extract:\n"
            "1. Exactly 5 technical interview questions suitable for evaluating candidates on this task.\n"
            "2. A concise description/summary of the project task.\n"
            "3. All relevant technical skills required to complete it.\n"
            "CRITICAL:\n"
            "1. You MUST output ONLY valid JSON format.\n"
            "2. Your output MUST be a JSON object with exactly three keys:\n"
            "   - 'questions': an array of exactly 5 strings (no more, no less).\n"
            "   - 'project_task': a string representing the project description.\n"
            "   - 'skills': an array of strings representing unique technical skill names.\n"
            "3. Do NOT include any conversational text, explanations, or markdown formatting.\n"
            "4. Be precise and clear."
        )
        
        user_prompt = f"""
Analyze the following task description and extract the required details:

TASK DESCRIPTION:
{raw_text[:8000]}

Output Format Example (JSON ONLY):
{{
  "questions": [
    "Question 1?",
    "Question 2?",
    "Question 3?",
    "Question 4?",
    "Question 5?"
  ],
  "project_task": "Concise summary of the task.",
  "skills": ["Skill1", "Skill2", "Skill3"]
}}
"""

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
                temperature=0.0
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
            if len(questions) != 5:
                # Fallback to pad or truncate to exactly 5 questions
                if len(questions) < 5:
                    questions.extend([f"Technical Question {i}" for i in range(len(questions) + 1, 6)])
                else:
                    questions = questions[:5]
            
            project_task = data.get("project_task") or ""
            skills = data.get("skills", [])
            if not isinstance(skills, list):
                skills = []
            
            cleaned_skills = sorted(list(set([str(skill).strip() for skill in skills if skill])))
            
            return {
                "questions": questions,
                "project_task": str(project_task).strip(),
                "skills": cleaned_skills
            }

        except Exception as e:
            logger.error("LLM task paper details extraction failed: %s", e)
            return {
                "questions": [f"Technical Question {i}" for i in range(1, 6)],
                "project_task": "",
                "skills": []
            }

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
            from app.v1.db.models.candidate_test_paper import CandidateTestPaper
            stmt_paper = select(CandidateTestPaper).where(CandidateTestPaper.candidate_id == candidate_id)
            res_paper = await db.execute(stmt_paper)
            test_paper = res_paper.scalar_one_or_none()
            
            if test_paper and test_paper.task_file_path:
                task_file_path = test_paper.task_file_path
                task_skills = test_paper.task_skills
                is_custom_task = True
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
            from app.v1.db.models.candidate_test_paper import CandidateTestPaper
            stmt_paper = select(CandidateTestPaper).where(CandidateTestPaper.candidate_id == candidate_id)
            res_paper = await db.execute(stmt_paper)
            test_paper = res_paper.scalar_one_or_none()
            if test_paper and test_paper.task_file_path:
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

candidate_task_service = CandidateTaskService()
