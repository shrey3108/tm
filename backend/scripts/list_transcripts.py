
import asyncio
from app.v1.db.session import engine
from sqlalchemy import select
from app.v1.db.models.transcripts import Transcript

async def check():
    async with engine.connect() as conn:
        res = await conn.execute(select(Transcript))
        rows = res.fetchall()
        for r in rows:
            print(f"ID: {r.id}, Text Length: {len(r.clean_transcript_text)}")

if __name__ == "__main__":
    asyncio.run(check())
