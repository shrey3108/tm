
import asyncio
from app.v1.db.session import engine
from sqlalchemy import select
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.candidate_stages import CandidateStage

async def find():
    async with engine.connect() as conn:
        res = await conn.execute(
            select(Candidate.id, Candidate.first_name, Candidate.last_name)
            .where(Candidate.first_name.ilike('%Heer%'))
        )
        row = res.fetchone()
        if row:
            cid = row.id
            print(f"Candidate ID: {cid}")
            res_stages = await conn.execute(
                select(CandidateStage.id, CandidateStage.status)
                .where(CandidateStage.candidate_id == cid)
            )
            stages = res_stages.fetchall()
            if stages:
                for s in stages:
                    print(f"Stage ID: {s.id} | Status: {s.status}")
            else:
                print("No stages found for this candidate.")
        else:
            print("Candidate not found.")

if __name__ == "__main__":
    asyncio.run(find())
