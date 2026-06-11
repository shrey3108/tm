
import asyncio
from app.v1.db.session import engine
from sqlalchemy import select
from app.v1.db.models.candidates import Candidate

async def list_candidates():
    async with engine.begin() as conn:
        res = await conn.execute(select(Candidate).limit(5))
        candidates = res.fetchall()
        print("\n--- Available Candidates for Testing ---")
        for c in candidates:
            print(f"ID: {c.id} | Name: {c.first_name} {c.last_name}")

if __name__ == "__main__":
    asyncio.run(list_candidates())
