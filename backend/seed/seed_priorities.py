import asyncio
import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.v1.db.session import async_session_maker, init_db
from app.v1.db.models.job_priorities import JobPriority
from sqlalchemy import select
from app.v1.utils.uuid import UUIDHelper

async def main():
    await init_db()
    async with async_session_maker() as session:
        print("Checking job priorities...")
        # Check if priorities already exist
        stmt = select(JobPriority)
        result = await session.execute(stmt)
        existing = result.scalars().all()
        if not existing:
            print("Seeding job priorities...")
            priorities = [
                {"name": "P1", "duration_days": 30},
                {"name": "P2", "duration_days": 60},
                {"name": "P3", "duration_days": 90},
            ]
            for p in priorities:
                job_priority = JobPriority(
                    id=UUIDHelper.generate_uuid7(),
                    name=p["name"],
                    duration_days=p["duration_days"]
                )
                session.add(job_priority)
            await session.commit()
            print("Seeding job priorities successful.")
        else:
            print("Job priorities already exist. Skipping seed.")

if __name__ == "__main__":
    asyncio.run(main())

