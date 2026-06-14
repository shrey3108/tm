"""
Celery tasks for resume processing and cross-job matching.
"""

import asyncio
import uuid
import logging

from pathlib import Path
from app.v1.core.celery_app import celery_app
from .background import BackgroundProcessor
from .processor import ResumeProcessor

_log = logging.getLogger(__name__)

async def run_task_with_disposal(coro):
    """Helper to run a coroutine and dispose of resources afterwards.
    
    This prevents 'attached to a different loop' errors in Celery workers
    by ensuring the connection pool and cache client are cleared before the loop closes.
    """
    try:
        await coro
    finally:
        from app.v1.db.session import engine
        from app.v1.core.cache import cache
        try:
            from litellm.llms.custom_httpx.async_client_cleanup import close_litellm_async_clients
            await asyncio.wait_for(close_litellm_async_clients(), timeout=5.0)
        except Exception:
            pass
        # We use a timeout to avoid hangs during disposal
        try:
            await asyncio.wait_for(engine.dispose(), timeout=5.0)
        except Exception:
            _log.warning("Engine disposal timed out or failed")
        try:
            await asyncio.wait_for(cache.close(), timeout=5.0)
        except Exception:
            _log.warning("Cache closing timed out or failed")

@celery_app.task(name="process_resume_task", bind=True, max_retries=3)
def process_resume_task(
    self,
    job_id_str: str,
    resume_id_str: str,
    file_path: str,
    existing_resume_id_str: str | None = None,
    override_version_num: int | None = None,
):
    """Celery task to process a single resume upload."""
    print(f"[V2] Received task for resume_id={resume_id_str}, path={file_path}")
    
    # Forceful path normalization at the task entry point
    normalized_path = str(Path(file_path).resolve())
    print(f"[V2] Normalized path for worker: {normalized_path}")
    
    job_id = uuid.UUID(job_id_str)
    resume_id = uuid.UUID(resume_id_str)
    existing_resume_id = uuid.UUID(existing_resume_id_str) if existing_resume_id_str else None
    
    processor = ResumeProcessor()
    bg_processor = BackgroundProcessor(processor)
    
    try:
        asyncio.run(
            run_task_with_disposal(
                bg_processor.process_resume_in_background(
                    job_id=job_id,
                    resume_id=resume_id,
                    file_path=normalized_path,
                    existing_resume_id=existing_resume_id,
                    override_version=override_version_num,
                )
            )
        )
    except Exception as exc:
        msg = f"[V2] Celery process_resume_task failed: {str(exc)}"
        _log.exception(msg)
        raise self.retry(exc=exc, countdown=60)

@celery_app.task(name="mass_refresh_task", bind=True, max_retries=3)
def mass_refresh_task(self, job_id_str: str, full_refresh: bool = False):
    """Celery task to mass refresh custom extractions for all resumes of a job."""
    job_id = uuid.UUID(job_id_str)
    
    processor = ResumeProcessor()
    bg_processor = BackgroundProcessor(processor)
    
    try:
        asyncio.run(
            run_task_with_disposal(
                bg_processor.mass_refresh_in_background(
                    job_id=job_id, full_refresh=full_refresh
                )
            )
        )
    except Exception as exc:
        _log.exception("Celery mass refresh task failed for job_id=%s", job_id)
        raise self.retry(exc=exc, countdown=60)

@celery_app.task(name="reanalyze_candidate_task", bind=True, max_retries=3)
def reanalyze_candidate_task(self, job_id_str: str, candidate_id_str: str, override_version_num: int | None = None):
    """Celery task to reanalyze a single candidate based on the current Job Description."""
    job_id = uuid.UUID(job_id_str)
    candidate_id = uuid.UUID(candidate_id_str)
    
    processor = ResumeProcessor()
    bg_processor = BackgroundProcessor(processor)
    
    try:
        asyncio.run(
            run_task_with_disposal(
                bg_processor.reanalyze_candidate_in_background(
                    job_id=job_id, 
                    candidate_id=candidate_id,
                    override_version=override_version_num
                )
            )
        )
    except Exception as exc:
        _log.exception("Celery candidate reanalyze task failed for candidate_id=%s", candidate_id)
        raise self.retry(exc=exc, countdown=60)

@celery_app.task(name="cross_match_resume_task", bind=True, max_retries=2)
def cross_match_resume_task(self, resume_id_str: str, original_job_id_str: str):
    """Celery task to run the cross-job matching for a failed candidate."""
    resume_id = uuid.UUID(resume_id_str)
    job_id = uuid.UUID(original_job_id_str)
    
    from app.v1.services.cross_job_match_service import cross_job_match_service
    
    try:
        asyncio.run(
            run_task_with_disposal(
                cross_job_match_service.run_cross_match(
                    resume_id=resume_id, original_job_id=job_id
                )
            )
        )
    except Exception as exc:
        _log.exception("Cross-match Celery task failed for resume_id=%s", resume_id)
        raise self.retry(exc=exc, countdown=120)
