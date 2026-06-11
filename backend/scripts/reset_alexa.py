
import asyncio
from app.v1.db.session import engine
from sqlalchemy import update
from app.v1.db.models.candidate_stages import CandidateStage

async def reset():
    async with engine.begin() as conn:
        await conn.execute(
            update(CandidateStage)
            .where(CandidateStage.candidate_id == '019da3bb-004e-771c-9587-0d36fe8eb310')
            .values(status='pending')
        )
        print("Status reset to pending for Alexa.")

if __name__ == "__main__":
    asyncio.run(reset())
