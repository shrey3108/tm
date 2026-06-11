import asyncio
import logging
from sqlalchemy import text
from app.v1.db.session import async_session_maker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def apply_migration():
    async with async_session_maker() as session:
        try:
            logger.info("Dropping NOT NULL constraint on candidate_test_papers.candidate_id...")
            await session.execute(text("ALTER TABLE candidate_test_papers ALTER COLUMN candidate_id DROP NOT NULL;"))
            
            logger.info("Adding partial unique index on candidate_test_papers.job_id WHERE candidate_id IS NULL...")
            await session.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_candidate_test_papers_job_id_null_candidate "
                "ON candidate_test_papers (job_id) WHERE (candidate_id IS NULL);"
            ))
            
            await session.commit()
            logger.info("Migration applied successfully!")
        except Exception as e:
            logger.error(f"Error applying migration: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(apply_migration())
