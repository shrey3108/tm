
import asyncio
from app.v1.db.session import engine
from sqlalchemy import select
from app.v1.db.models.candidate_stages import CandidateStage

async def check():
    async with engine.connect() as conn:
        res = await conn.execute(
            select(CandidateStage.id, CandidateStage.status)
            .where(CandidateStage.candidate_id == '019db43c-d112-7443-b662-933d05505ad4')
        )
        for r in res.fetchall():
            print(f"Stage ID: {r.id} | Status: {r.status}")

if __name__ == "__main__":
    asyncio.run(check())
