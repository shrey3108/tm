
import asyncio
from app.v1.db.session import engine
from sqlalchemy import select
from app.v1.db.models.candidates import Candidate

async def check():
    async with engine.connect() as conn:
        res = await conn.execute(
            select(Candidate.id, Candidate.first_name, Candidate.last_name, Candidate.applied_job_id)
        )
        for r in res.fetchall():
            print(f"ID: {r.id} | Name: {r.first_name} {r.last_name} | Job ID: {r.applied_job_id}")

if __name__ == "__main__":
    asyncio.run(check())
