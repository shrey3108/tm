
import asyncio
from sqlalchemy import text
from app.v1.db.session import async_session_maker

async def add_position_column():
    print("Adding 'position' column to 'jobs' table...")
    async with async_session_maker() as db:
        try:
            # Add column if not exists
            await db.execute(text("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS position VARCHAR(100)"))
            await db.commit()
            print("Successfully added 'position' column!")
        except Exception as e:
            print(f"Error adding column: {e}")
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(add_position_column())
