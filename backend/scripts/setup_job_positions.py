
import asyncio
import uuid
from sqlalchemy import text
from app.v1.db.session import async_session_maker
from app.v1.utils.uuid import UUIDHelper

async def setup_job_positions():
    print("Setting up 'job_positions' table...")
    async with async_session_maker() as db:
        try:
            # 1. Create table
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS job_positions (
                    id UUID PRIMARY KEY,
                    name VARCHAR(100) UNIQUE NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """))
            
            # Ensure defaults exist if table was created without them
            await db.execute(text("ALTER TABLE job_positions ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP"))
            await db.execute(text("ALTER TABLE job_positions ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP"))
            
            # 2. Add position_id to jobs
            await db.execute(text("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES job_positions(id) ON DELETE SET NULL"))
            
            # 3. Seed default positions
            defaults = ["Freshers", "Intermediate", "Intern", "Senior"]
            for name in defaults:
                check_stmt = text("SELECT id FROM job_positions WHERE name = :name")
                exists = (await db.execute(check_stmt, {"name": name})).scalar()
                if not exists:
                    insert_stmt = text("INSERT INTO job_positions (id, name, created_at, updated_at) VALUES (:id, :name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
                    await db.execute(insert_stmt, {"id": UUIDHelper.generate_uuid7(), "name": name})
            
            await db.commit()
            print("Successfully set up job positions!")
        except Exception as e:
            print(f"Error during setup: {e}")
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(setup_job_positions())
