import json
import logging
import os
import uuid
import openai
from pathlib import Path
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.core.config import settings
from app.v1.core.extractor import DocumentParser
from app.v1.core.storage import resolve_storage_path, to_storage_relative_path
from app.v1.db.models.jobs import Job
from app.v1.repository.job_repository import job_repository

logger = logging.getLogger(__name__)

class TaskService:
    """Service to handle candidate task files and skill extraction."""

    async def upload_and_extract_task_skills(
        self, db: AsyncSession, job_id: uuid.UUID, task_file: UploadFile
    ) -> Job:
        # 1. Verify Job exists
        job = await job_repository.get(db=db, id=job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found.",
            )

        # 2. Setup upload directory and save file
        tasks_dir = resolve_storage_path(settings.TASK_UPLOAD_DIR)
        tasks_dir.mkdir(parents=True, exist_ok=True)
        
        # Save task PDF to local filesystem
        file_extension = Path(task_file.filename).suffix.lower()
        if file_extension not in [".pdf", ".docx", ".doc"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format: {file_extension}. Only PDF, DOC, and DOCX are allowed.",
            )
            
        file_name = f"task_{job_id}{file_extension}"
        target_path = tasks_dir / file_name
        stored_file_path = to_storage_relative_path(target_path)
        
        try:
            content = await task_file.read()
            target_path.write_bytes(content)
        except Exception as e:
            logger.error("Failed to save task file to disk: %s", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save uploaded file.",
            )

        # 3. Update database with file path and reset skills while background processing starts
        try:
            job.task_file_path = stored_file_path
            job.task_skills = None  # Clear while processing in background
            
            db.add(job)
            await db.commit()
            await db.refresh(job)
        except Exception as e:
            logger.error("Database update failed for task details upload: %s", e)
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update database with task file details.",
            )

        # 4. Clear job cache
        from app.v1.core.cache import cache
        await cache.clear(pattern="jobs:list:*")
        await cache.clear(pattern="jobs:search:*")
        await cache.delete(f"job_embedding:{job_id}_v{job.version}")

        # 5. Dispatch background Celery task (runtime import avoids circular dependecy)
        from app.v1.services.admin.job_tasks import extract_task_skills_task
        logger.info("Triggering background Celery task for skill extraction: %s", job_id)
        extract_task_skills_task.delay(str(job_id), stored_file_path)

        return job

    async def extract_skills_from_file_and_update(
        self, db: AsyncSession, job_id: uuid.UUID, file_path: Path
    ) -> list[str]:
        """Runs in background worker: parses text from document, calls LLM, and updates db."""
        # 1. Verify Job exists
        job = await job_repository.get(db=db, id=job_id)
        if not job:
            logger.error("Job not found for background extraction: %s", job_id)
            return []

        # 2. Parse text from the uploaded document
        try:
            raw_text = DocumentParser.extract_text(file_path)
        except Exception as e:
            logger.error("Failed to parse text from task file in background: %s", e)
            return []

        if not raw_text or not raw_text.strip():
            logger.error("The task document contains no readable text: %s", file_path)
            return []

        # 3. Invoke LLM to extract required skills
        logger.info("Extracting skills from task description using LLM in background...")
        extracted_skills = await self._extract_skills_from_text(raw_text)

        # 4. Update Job record in database
        try:
            job.task_skills = extracted_skills
            db.add(job)
            await db.commit()
            await db.refresh(job)
        except Exception as e:
            logger.error("Database update failed for task details in background: %s", e)
            await db.rollback()
            return []

        # 5. Clear job cache
        from app.v1.core.cache import cache
        await cache.clear(pattern="jobs:list:*")
        await cache.clear(pattern="jobs:search:*")
        await cache.delete(f"job_embedding:{job_id}_v{job.version}")

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
            # Build robust base URL matching settings
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
            
            # Clean possible markdown wrap
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            data = json.loads(response_text)
            skills = data.get("skills", [])
            
            # Deduplicate and clean up
            cleaned_skills = sorted(list(set([str(skill).strip() for skill in skills if skill])))
            return cleaned_skills

        except Exception as e:
            logger.error("LLM task skill extraction failed: %s", e)
            # Return empty or fallback estimation if parsing fails completely
            return []

    async def delete_task_skills(self, db: AsyncSession, job_id: uuid.UUID) -> Job:
        # 1. Verify Job exists
        job = await job_repository.get(db=db, id=job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found.",
            )

        # 2. Delete task file from disk if it exists
        if job.task_file_path:
            try:
                file_path = resolve_storage_path(job.task_file_path)
                if file_path.exists() and file_path.is_file():
                    file_path.unlink()
            except Exception as e:
                logger.error("Failed to delete task file: %s", e)

        # 3. Reset fields
        try:
            job.task_file_path = None
            job.task_skills = None
            
            db.add(job)
            await db.commit()
            await db.refresh(job)
        except Exception as e:
            logger.error("Database update failed for task details delete: %s", e)
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to remove task details from the database.",
            )

        # Clear job cache so the updated job is fetched
        from app.v1.core.cache import cache
        await cache.clear(pattern="jobs:list:*")
        await cache.clear(pattern="jobs:search:*")
        await cache.delete(f"job_embedding:{job_id}_v{job.version}")

        return job

    async def get_task_skills(self, db: AsyncSession, job_id: uuid.UUID) -> Job:
        # 1. Verify Job exists
        job = await job_repository.get(db=db, id=job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found.",
            )
        return job

task_service = TaskService()
