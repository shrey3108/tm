
import asyncio
from app.v1.db.session import engine
from sqlalchemy import select
from app.v1.db.models.candidates import Candidate

async def find():
    async with engine.connect() as conn:
        res = await conn.execute(
            select(Candidate.id, Candidate.first_name, Candidate.last_name)
            .where(Candidate.first_name.ilike('%Heer%'))
        )
        for r in res.fetchall():
            print(f"ID: {r.id} | Name: {r.first_name} {r.last_name}")

if __name__ == "__main__":
    asyncio.run(find())
