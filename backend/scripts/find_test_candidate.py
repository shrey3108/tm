
import asyncio
from app.v1.db.session import engine
from sqlalchemy import select
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.candidates import Candidate

async def find():
    async with engine.connect() as conn:
        stmt = (
            select(CandidateStage.candidate_id, Candidate.first_name, Candidate.last_name, Candidate.applied_job_id)
            .join(Candidate, Candidate.id == CandidateStage.candidate_id)
            .where(CandidateStage.status == 'pending')
            .limit(1)
        )
        res = await conn.execute(stmt)
        row = res.fetchone()
        if row:
            print(f"CANDIDATE_ID={row[0]}")
            print(f"NAME={row[1]} {row[2]}")
            print(f"APPLIED_JOB_ID={row[3]}")
        else:
            print("No candidate with pending stage found.")

if __name__ == "__main__":
    asyncio.run(find())
