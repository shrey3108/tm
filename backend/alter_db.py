import asyncio
import logging
from sqlalchemy import text
from app.v1.db.session import async_session_maker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def alter_tables():
    async with async_session_maker() as session:
        try:
            logger.info("Dropping NOT NULL constraint on files.candidate_id...")
            await session.execute(text("ALTER TABLE files ALTER COLUMN candidate_id DROP NOT NULL;"))
            logger.info("Dropping NOT NULL constraint on resumes.candidate_id...")
            await session.execute(text("ALTER TABLE resumes ALTER COLUMN candidate_id DROP NOT NULL;"))
            await session.commit()
            logger.info("Successfully updated constraints.")
        except Exception as e:
            logger.error(f"Error updating constraints: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(alter_tables())
