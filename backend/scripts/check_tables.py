
import asyncio
from app.v1.db.session import engine
from sqlalchemy import text

async def check():
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
        tables = [row[0] for row in res.fetchall()]
        print("Tables in public schema:")
        for t in tables:
            print(f"- {t}")

if __name__ == "__main__":
    asyncio.run(check())
