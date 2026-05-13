import asyncio
import sys
import os

sys.path.append(os.getcwd())

from sqlalchemy import select
from app.v1.db.session import async_session_maker
from app.v1.db.models.system_settings import SystemSetting

async def check_settings():
    async with async_session_maker() as db:
        result = await db.execute(select(SystemSetting))
        settings = result.scalars().all()
        print("--- System Settings ---")
        for s in settings:
            print(f"Key: {s.key}, Value: {s.value}")
        if not settings:
            print("No settings found in database.")

if __name__ == "__main__":
    asyncio.run(check_settings())
