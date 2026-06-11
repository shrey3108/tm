
import asyncio
from app.v1.db.session import engine
from sqlalchemy import update
from app.v1.db.models.candidate_stages import CandidateStage

async def reset():
    async with engine.begin() as conn:
        await conn.execute(
            update(CandidateStage)
            .where(CandidateStage.candidate_id == '019daae7-1736-7244-b6b1-e0a529e68cc3')
            .values(status='pending')
        )
        print("Reset successful.")

if __name__ == "__main__":
    asyncio.run(reset())
