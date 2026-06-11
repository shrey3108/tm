
import asyncio
from app.v1.db.session import engine
from sqlalchemy import select
from app.v1.db.models.candidates import Candidate

async def check_candidate():
    async with engine.begin() as conn:
        cid = "019da3bb-004e-771c-9587-0d36fe8eb310"
        res = await conn.execute(select(Candidate).where(Candidate.id == cid))
        candidate = res.fetchone()
        if candidate:
            print(f"Candidate found: {candidate.first_name} {candidate.last_name}")
        else:
            print("Candidate not found. Fetching first available candidate...")
            res = await conn.execute(select(Candidate).limit(1))
            candidate = res.fetchone()
            if candidate:
                print(f"Use this ID instead: {candidate.id} ({candidate.first_name})")

if __name__ == "__main__":
    asyncio.run(check_candidate())
