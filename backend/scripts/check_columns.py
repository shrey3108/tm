
import asyncio
from app.v1.db.session import engine
from sqlalchemy import text

async def check():
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='transcripts'"))
        columns = [row[0] for row in res.fetchall()]
        print("Columns in transcripts table:")
        for c in columns:
            print(f"- {c}")

if __name__ == "__main__":
    asyncio.run(check())
