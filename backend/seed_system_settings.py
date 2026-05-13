import asyncio
import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())

from app.v1.db.session import async_session_maker
from app.v1.db.models.system_settings import SystemSetting
from sqlalchemy import select

async def seed_system_settings():
    """Seed initial system settings for the application."""
    initial_settings = [
        {
            "key": "transcript_default_dir",
            "value": "C:/OneDriveTemp/Desktop/hirego/transcripts",
            "description": "Default directory where interview transcripts are stored."
        }
    ]

    async with async_session_maker() as db:
        print("Starting to seed system settings...")
        for setting_data in initial_settings:
            # Check if setting already exists
            stmt = select(SystemSetting).where(SystemSetting.key == setting_data["key"])
            result = await db.execute(stmt)
            existing = result.scalar_one_or_none()
            
            if not existing:
                new_setting = SystemSetting(**setting_data)
                db.add(new_setting)
                print(f"Added setting: {setting_data['key']} = {setting_data['value']}")
            else:
                print(f"Setting '{setting_data['key']}' already exists. Skipping.")
        
        await db.commit()
        print("Seeding completed successfully.")

if __name__ == "__main__":
    asyncio.run(seed_system_settings())
