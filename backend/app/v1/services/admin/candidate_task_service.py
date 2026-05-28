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
from app.v1.db.models.candidates import Candidate

logger = logging.getLogger(__name__)

class CandidateTaskService:
    """Service to handle candidate-specific custom task files and skill extraction."""

    async def upload_and_extract_candidate_task_skills(
        self, db: AsyncSession, candidate_id: uuid.UUID, task_file: UploadFile
    ) -> Candidate:
        # 1. Verify Candidate exists
        stmt = select(Candidate).options(selectinload(Candidate.applied_job)).where(Candidate.id == candidate_id)
        result = await db.execute(stmt)
        candidate = result.scalar_one_or_none()
        if not candidate:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Candidate not found.",
            )

        # 2. Setup upload directory and save file
        tasks_dir = Path("uploads/tasks")
        tasks_dir.mkdir(parents=True, exist_ok=True)
        
        # Save task PDF/DOCX to local filesystem
        file_extension = Path(task_file.filename).suffix.lower()
        if file_extension not in [".pdf", ".docx", ".doc"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format: {file_extension}. Only PDF, DOC, and DOCX are allowed.",
            )
            
        file_name = f"candidate_{candidate_id}{file_extension}"
        file_path = tasks_dir / file_name
        
        try:
            content = await task_file.read()
            with open(file_path, "wb") as f:
                f.write(content)
        except Exception as e:
            logger.error("Failed to save candidate task file to disk: %s", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save uploaded file.",
            )

        # 3. Update database with file path and reset skills while background processing starts
        try:
            candidate.task_file_path = str(file_path)
            candidate.task_skills = None  # Clear while processing in background
            
            db.add(candidate)
            await db.commit()
            await db.refresh(candidate)
        except Exception as e:
            logger.error("Database update failed for candidate task details upload: %s", e)
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update database with candidate task file details.",
            )

        # 4. Clear candidate-related caches
        from app.v1.core.cache import cache
        await cache.clear(pattern="candidates:*")

        # 5. Dispatch background Celery task (runtime import avoids circular dependency)
        from app.v1.services.admin.job_tasks import extract_candidate_task_skills_task
        logger.info("Triggering background Celery task for candidate skill extraction: %s", candidate_id)
        extract_candidate_task_skills_task.delay(str(candidate_id), str(file_path))

        return candidate

    async def extract_candidate_skills_from_file_and_update(
        self, db: AsyncSession, candidate_id: uuid.UUID, file_path: Path
    ) -> list[str]:
        """Runs in background worker: parses text from document, calls LLM, and updates db."""
        # 1. Verify Candidate exists
        stmt = select(Candidate).where(Candidate.id == candidate_id)
        result = await db.execute(stmt)
        candidate = result.scalar_one_or_none()
        if not candidate:
            logger.error("Candidate not found for background extraction: %s", candidate_id)
            return []

        # 2. Parse text from the uploaded document
        try:
            raw_text = DocumentParser.extract_text(file_path)
        except Exception as e:
            logger.error("Failed to parse text from candidate task file in background: %s", e)
            return []

        if not raw_text or not raw_text.strip():
            logger.error("The candidate task document contains no readable text: %s", file_path)
            return []

        # 3. Invoke LLM to extract required skills
        logger.info("Extracting skills from candidate task description using LLM in background...")
        extracted_skills = await self._extract_skills_from_text(raw_text)

        # 4. Update Candidate record in database
        try:
            candidate.task_skills = extracted_skills
            db.add(candidate)
            await db.commit()
            await db.refresh(candidate)
        except Exception as e:
            logger.error("Database update failed for candidate task details in background: %s", e)
            await db.rollback()
            return []

        # 5. Clear caches
        from app.v1.core.cache import cache
        await cache.clear(pattern="candidates:*")

        return extracted_skills

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

    async def delete_candidate_task_skills(self, db: AsyncSession, candidate_id: uuid.UUID) -> Candidate:
        # 1. Verify Candidate exists
        stmt = select(Candidate).where(Candidate.id == candidate_id)
        result = await db.execute(stmt)
        candidate = result.scalar_one_or_none()
        if not candidate:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Candidate not found.",
            )

        # 2. Delete task file from disk if it exists
        if candidate.task_file_path:
            try:
                file_path = Path(candidate.task_file_path)
                if file_path.exists() and file_path.is_file():
                    file_path.unlink()
            except Exception as e:
                logger.error("Failed to delete candidate task file: %s", e)

        # 3. Reset fields
        try:
            candidate.task_file_path = None
            candidate.task_skills = None
            
            db.add(candidate)
            await db.commit()
            await db.refresh(candidate)
        except Exception as e:
            logger.error("Database update failed for candidate task details delete: %s", e)
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to remove candidate task details from the database.",
            )

        # Clear caches
        from app.v1.core.cache import cache
        await cache.clear(pattern="candidates:*")

        return candidate

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

        if not task_file_path and candidate.applied_job:
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
            # Fallback to job default task skills
            task_skills = job.task_skills or []
        else:
            task_skills = task_skills or []

        return {
            "job_skills": job_skills,
            "task_skills": task_skills
        }

candidate_task_service = CandidateTaskService()
