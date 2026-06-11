
import asyncio
from app.v1.db.session import engine
from sqlalchemy import select
from app.v1.db.models.transcripts import Transcript

async def check():
    async with engine.connect() as conn:
        res = await conn.execute(
            select(Transcript).where(Transcript.id == '019dbe73-ef12-70e8-adc3-22c5eb6c4bc1')
        )
        row = res.fetchone()
        if row:
            print(f"Text Preview: {row.clean_transcript_text[:500]}")
            print(f"Segments: {row.segments}")

if __name__ == "__main__":
    asyncio.run(check())
