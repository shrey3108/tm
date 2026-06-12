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
        asyncio.run(deactivate_expired_jobs_logic())
    except Exception as exc:
        _log.exception("Failed to run deactivate_expired_jobs_task")
    finally:
        # Dispose engine to prevent connection leaks in worker
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(engine.dispose())
            else:
                asyncio.run(engine.dispose())
        except Exception:
            pass

@celery_app.task(name="match_all_resumes_to_job_task")
def match_all_resumes_to_job_task(job_id_str: str, months_limit: int = 3):
    """Celery task to match existing resumes against a new job."""
    from app.v1.services.cross_job_match_service import cross_job_match_service

    job_id = uuid.UUID(job_id_str)
    try:
        _log.info(f"Starting mass resume matching for new job: {job_id} (limit: {months_limit} months)")
        asyncio.run(cross_job_match_service.run_new_job_matching(job_id, months_limit=months_limit))
        _log.info(f"Successfully finished mass matching for job: {job_id}")
    except Exception as exc:
        _log.exception(f"Failed to run match_all_resumes_to_job_task for job {job_id}")
    finally:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(engine.dispose())
            else:
                asyncio.run(engine.dispose())
        except Exception:
            pass


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
        asyncio.run(extract_task_skills_logic(job_id_str, file_path_str))
    except Exception as exc:
        _log.exception(f"Failed to run extract_task_skills_task for job {job_id_str}")
    finally:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(engine.dispose())
            else:
                asyncio.run(engine.dispose())
        except Exception:
            pass


async def extract_paper_task_skills_logic(paper_id_str: str, file_path_str: str):
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
        extracted_data = await candidate_task_service.extract_paper_details_from_text(raw_text)

        paper.questions = extracted_data["questions"]
        paper.project_task = extracted_data["project_task"]
        paper.task_skills = extracted_data["skills"]
        
        session.add(paper)
        await session.commit()
        _log.info(f"Successfully updated paper {paper_id} with extracted details: {extracted_data}")


@celery_app.task(name="extract_paper_task_skills_task")
def extract_paper_task_skills_task(paper_id_str: str, file_path_str: str):
    """Celery task wrapper for predefined paper task PDF skill extraction."""
    try:
        asyncio.run(extract_paper_task_skills_logic(paper_id_str, file_path_str))
    except Exception as exc:
        _log.exception(f"Failed to run extract_paper_task_skills_task for paper {paper_id_str}")
    finally:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(engine.dispose())
            else:
                asyncio.run(engine.dispose())
        except Exception:
            pass



