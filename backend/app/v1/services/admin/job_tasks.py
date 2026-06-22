import asyncio
import logging
import uuid
from datetime import datetime
from pathlib import Path
from sqlalchemy import select, update
from app.v1.core.celery_app import celery_app
from app.v1.db.models.jobs import Job
from app.v1.db.session import async_session_maker, engine

_log = logging.getLogger(__name__)

async def run_with_cleanup(coro):
    try:
        return await coro
    finally:
        try:
            from litellm.llms.custom_httpx.async_client_cleanup import close_litellm_async_clients
            await close_litellm_async_clients()
        except Exception:
            pass
        try:
            from app.v1.core.cache import cache
            await cache.close()
        except Exception:
            pass
        try:
            await engine.dispose()
        except Exception:
            pass

async def deactivate_expired_jobs_logic():
    """Logic to find and deactivate jobs whose priority period has ended."""
    async with async_session_maker() as session:
        now = datetime.now()
        
        # Find jobs that are active but past their end date
        stmt = (
            update(Job)
            .where(
                Job.is_active == True,
                Job.priority_end_date != None,
                Job.priority_end_date < now
            )
            .values(is_active=False)
            .execution_options(synchronize_session="fetch")
        )
        
        result = await session.execute(stmt)
        await session.commit()
        
        if result.rowcount > 0:
            _log.info(f"Deactivated {result.rowcount} expired jobs.")

@celery_app.task(name="deactivate_expired_jobs_task")
def deactivate_expired_jobs_task():
    """Celery task wrapper for job deactivation."""
    try:
        asyncio.run(run_with_cleanup(deactivate_expired_jobs_logic()))
    except Exception as exc:
        _log.exception("Failed to run deactivate_expired_jobs_task")

@celery_app.task(name="match_all_resumes_to_job_task")
def match_all_resumes_to_job_task(job_id_str: str, months_limit: int = 3):
    """Celery task to match existing resumes against a new job."""
    from app.v1.services.cross_job_match_service import cross_job_match_service

    job_id = uuid.UUID(job_id_str)
    try:
        _log.info(f"Starting mass resume matching for new job: {job_id} (limit: {months_limit} months)")
        asyncio.run(run_with_cleanup(cross_job_match_service.run_new_job_matching(job_id, months_limit=months_limit)))
        _log.info(f"Successfully finished mass matching for job: {job_id}")
    except Exception as exc:
        _log.exception(f"Failed to run match_all_resumes_to_job_task for job {job_id}")


async def extract_task_skills_logic(job_id_str: str, file_path_str: str):
    """Logic to extract skills from an uploaded task description file and update the database."""
    from app.v1.services.admin.task_service import task_service
    
    job_id = uuid.UUID(job_id_str)
    file_path = Path(file_path_str)
    
    async with async_session_maker() as session:
        await task_service.extract_skills_from_file_and_update(session, job_id, file_path)


@celery_app.task(name="extract_task_skills_task")
def extract_task_skills_task(job_id_str: str, file_path_str: str):
    """Celery task wrapper for task PDF skill extraction."""
    try:
        asyncio.run(run_with_cleanup(extract_task_skills_logic(job_id_str, file_path_str)))
    except Exception as exc:
        _log.exception(f"Failed to run extract_task_skills_task for job {job_id_str}")


async def extract_paper_task_skills_logic(paper_id_str: str, file_path_str: str, paper_type: str = "normal"):
    """Logic to extract skills from a QuestionSetPaper's task file and update the database."""
    from app.v1.db.models.question_set_paper import QuestionSetPaper
    from app.v1.services.admin.candidate_task_service import candidate_task_service

    paper_id = uuid.UUID(paper_id_str)
    file_path = Path(file_path_str)

    async with async_session_maker() as session:
        paper = await session.get(QuestionSetPaper, paper_id)
        if not paper:
            _log.error(f"QuestionSetPaper not found for background extraction: {paper_id}")
            return

        try:
            from app.v1.core.extractor import DocumentParser
            raw_text = DocumentParser.extract_text_docling(file_path)
        except Exception as e:
            _log.error(f"Failed to parse text from paper task file in background: {e}")
            return

        if not raw_text or not raw_text.strip():
            _log.error(f"The paper task document contains no readable text: {file_path}")
            return

        _log.info(f"Extracting details from paper task document using LLM: {paper_id}")
        extracted_data = await candidate_task_service.extract_paper_details_from_text(raw_text, paper_type)

        paper.questions = extracted_data["questions"]
        paper.mcqs = extracted_data["mcqs"]
        paper.project_task = extracted_data["project_task"]
        paper.task_skills = extracted_data["skills"]

        # Sync with database skills table
        if extracted_data["skills"]:
            from app.v1.db.models.skills import Skill
            from sqlalchemy import func
            stmt_skills = select(Skill).where(
                func.lower(Skill.name).in_([s.lower() for s in extracted_data["skills"]])
            )
            matched_skills = (await session.execute(stmt_skills)).scalars().all()
            paper.skills = list(matched_skills)
        else:
            paper.skills = []
        
        session.add(paper)
        await session.commit()
        _log.info(f"Successfully updated paper {paper_id} with extracted details: {extracted_data}")

        # Clear predefined task papers cache immediately after background extraction completes
        try:
            from app.v1.core.cache import cache
            await cache.clear(pattern="cache:GET:/api/v1/task-papers*")
            _log.info("Successfully cleared predefined task papers cache after background extraction")
        except Exception as cache_err:
            _log.error(f"Failed to clear cache after background extraction: {cache_err}")


@celery_app.task(name="extract_paper_task_skills_task")
def extract_paper_task_skills_task(paper_id_str: str, file_path_str: str, paper_type: str = "normal"):
    """Celery task wrapper for predefined paper task PDF skill extraction."""
    try:
        asyncio.run(run_with_cleanup(extract_paper_task_skills_logic(paper_id_str, file_path_str, paper_type)))
    except Exception as exc:
        _log.exception(f"Failed to run extract_paper_task_skills_task for paper {paper_id_str}")


async def extract_paper_skills_from_text_logic(paper_id_str: str):
    """Logic to extract skills from a QuestionSetPaper's text fields (questions + tasks)."""
    from app.v1.db.models.question_set_paper import QuestionSetPaper
    from app.v1.services.admin.candidate_task_service import candidate_task_service

    paper_id = uuid.UUID(paper_id_str)

    async with async_session_maker() as session:
        paper = await session.get(QuestionSetPaper, paper_id)
        if not paper:
            _log.error(f"QuestionSetPaper not found for text background extraction: {paper_id}")
            return

        # Combine questions, mcqs and tasks into a single text block
        text_parts = []
        if paper.questions:
            text_parts.append("Questions:\n" + "\n".join(f"- {q}" for q in paper.questions))
        if paper.mcqs:
            text_parts.append("MCQs:\n" + "\n".join(f"- {m.get('question') if isinstance(m, dict) else m}" for m in paper.mcqs))
        if paper.project_task:
            text_parts.append("Tasks:\n" + "\n".join(f"- {t}" for t in paper.project_task))

        raw_text = "\n\n".join(text_parts)
        if not raw_text.strip():
            _log.warning(f"Paper has no text content to extract skills from: {paper_id}. Clearing existing skills.")
            paper.task_skills = []
            session.add(paper)
            await session.commit()
            try:
                from app.v1.core.cache import cache
                await cache.clear(pattern="cache:GET:/api/v1/task-papers*")
            except Exception:
                pass
            return

        _log.info(f"Extracting skills from manual paper text using LLM: {paper_id}")
        extracted_skills = await candidate_task_service._extract_skills_from_text(raw_text)

        paper.task_skills = extracted_skills

        # Sync with database skills table
        if extracted_skills:
            from app.v1.db.models.skills import Skill
            from sqlalchemy import func
            stmt_skills = select(Skill).where(
                func.lower(Skill.name).in_([s.lower() for s in extracted_skills])
            )
            matched_skills = (await session.execute(stmt_skills)).scalars().all()
            paper.skills = list(matched_skills)
        else:
            paper.skills = []
        
        session.add(paper)
        await session.commit()
        _log.info(f"Successfully updated paper {paper_id} with extracted skills from text: {extracted_skills}")

        try:
            from app.v1.core.cache import cache
            await cache.clear(pattern="cache:GET:/api/v1/task-papers*")
        except Exception:
            pass

@celery_app.task(name="extract_paper_skills_from_text_task")
def extract_paper_skills_from_text_task(paper_id_str: str):
    """Celery task wrapper for manual paper skill extraction from text."""
    try:
        asyncio.run(run_with_cleanup(extract_paper_skills_from_text_logic(paper_id_str)))
    except Exception as exc:
        _log.exception(f"Failed to run extract_paper_skills_from_text_task for paper {paper_id_str}")



