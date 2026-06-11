
import asyncio
from app.v1.db.session import engine
from sqlalchemy import update
from app.v1.db.models.candidate_stages import CandidateStage

async def reset_stages():
    async with engine.begin() as conn:
        candidate_ids = [
            "019d9b2e-32f3-75a9-be4a-eca2e41679a5", # Alex R. Rivera
            "019db43c-d112-7443-b662-933d05505ad4", # Heer Patel
            "019da3bb-004e-771c-9587-0d36fe8eb310"  # Alexa Stratton
        ]
        
        await conn.execute(
            update(CandidateStage)
            .where(CandidateStage.candidate_id.in_(candidate_ids))
            .values(status="pending")
        )
        print(f"Successfully reset stages for {len(candidate_ids)} candidates to 'pending'.")

if __name__ == "__main__":
    asyncio.run(reset_stages())
