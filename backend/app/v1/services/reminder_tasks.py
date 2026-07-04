import asyncio
from datetime import datetime, timezone, timedelta
from celery.utils.log import get_task_logger
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.v1.core.celery_app import celery_app
from app.v1.db.session import async_session_maker
from app.v1.db.models.associate_evaluations import AssociateEvaluation
from app.v1.db.models.jobs import Job
from app.v1.db.models.associates import Associate
from app.v1.db.models.candidate_test_paper import CandidateTestPaper
from app.v1.db.models.candidates import Candidate
from app.v1.services.email_service import send_associate_reminder_email

logger = get_task_logger(__name__)

def run_async(coro):
    """Run an async coroutine synchronously inside a Celery task."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)

async def async_send_associate_reminders():
    """Async logic to check for and send associate reminders."""
    now = datetime.now(timezone.utc)
    
    async with async_session_maker() as db:
        # Fetch all pending associate evaluations
        from app.v1.db.models.candidate_stages import CandidateStage
        from app.v1.db.models.job_stage_configs import JobStageConfig
        
        stmt = select(AssociateEvaluation).where(
            AssociateEvaluation.status == "sent",
            AssociateEvaluation.submitted_at.is_(None)
        ).options(
            selectinload(AssociateEvaluation.job),
            selectinload(AssociateEvaluation.associate),
            selectinload(AssociateEvaluation.candidate),
            selectinload(AssociateEvaluation.test_paper),
            selectinload(AssociateEvaluation.candidate_stage)
            .selectinload(CandidateStage.job_stage)
            .selectinload(JobStageConfig.template)
        )
        
        result = await db.execute(stmt)
        evaluations = result.scalars().all()
        
        count = 0
        for evaluation in evaluations:
            # Fallback for reminder interval
            interval_hours = evaluation.job.associate_reminder_hours if evaluation.job else 24
            
            # Determine threshold starting point
            last_ping = evaluation.last_reminder_sent_at or evaluation.sent_at
            
            # Ensure naive datetimes are converted or we work in UTC
            if last_ping.tzinfo is None:
                last_ping = last_ping.replace(tzinfo=timezone.utc)
                
            elapsed_minutes = (now - last_ping).total_seconds() / 60.0
            
            if elapsed_minutes >= (interval_hours * 60):
                # Time to send a reminder
                logger.info(f"Sending reminder to {evaluation.associate.email} for evaluation {evaluation.id}")
                
                # We need stage name if available
                stage_name = None
                if evaluation.candidate_stage and evaluation.candidate_stage.job_stage and evaluation.candidate_stage.job_stage.template:
                    stage_name = evaluation.candidate_stage.job_stage.template.name

                # Send email
                await send_associate_reminder_email(
                    associate_name=evaluation.associate.name,
                    associate_email=evaluation.associate.email,
                    candidate=evaluation.candidate,
                    test_paper=evaluation.test_paper,
                    review_token=evaluation.review_token,
                    job=evaluation.job,
                    stage_name=stage_name,
                )
                
                # Update DB
                evaluation.last_reminder_sent_at = now
                count += 1
                
        if count > 0:
            await db.commit()
            
    return count

@celery_app.task(name="send_associate_reminders_task")
def send_associate_reminders_task():
    """Periodic task to send email reminders to associates who haven't completed their evaluations."""
    logger.info("Starting send_associate_reminders_task...")
    count = run_async(async_send_associate_reminders())
    logger.info(f"Finished send_associate_reminders_task. Sent {count} reminders.")
