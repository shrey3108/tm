
import asyncio
import uuid
from app.v1.db.session import engine
from sqlalchemy import update
from app.v1.db.models.candidate_stages import CandidateStage

async def reset_specific_candidate(cid_str: str):
    async with engine.begin() as conn:
        cid = uuid.UUID(cid_str)
        await conn.execute(
            update(CandidateStage)
            .where(CandidateStage.candidate_id == cid)
            .values(status="pending")
        )
        print(f"Successfully reset stage for candidate {cid_str} to 'pending'.")

if __name__ == "__main__":
    import sys
    cid = sys.argv[1] if len(sys.argv) > 1 else "019dbf7c-9028-72f9-8ecd-42218d9b00d9"
    asyncio.run(reset_specific_candidate(cid))
