import asyncio
import sys
import os

sys.path.append(os.getcwd())

from app.v1.db.session import async_session_maker
from app.v1.db.models.system_settings import SystemSetting

async def seed_settings():
    async with async_session_maker() as db:
        # Check if it already exists
        from sqlalchemy import select
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == "transcript_default_dir"))
        existing = result.scalar_one_or_none()
        
        if not existing:
            new_setting = SystemSetting(
                key="transcript_default_dir",
                value="C:/OneDriveTemp/Desktop/hirego/transcripts",
                description="Default directory for transcripts"
            )
            db.add(new_setting)
            await db.commit()
            print("Successfully seeded transcript_default_dir.")
        else:
            print(f"Setting already exists: {existing.value}")

if __name__ == "__main__":
    asyncio.run(seed_settings())
