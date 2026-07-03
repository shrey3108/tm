import asyncio
import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.v1.db.session import async_session_maker, init_db
from app.v1.db.models.guidelines import Guideline
from sqlalchemy import select
from app.v1.utils.uuid import UUIDHelper

async def main():
    await init_db()
    async with async_session_maker() as session:
        print("Checking guidelines...")
        # Check if guidelines already exist
        stmt = select(Guideline)
        result = await session.execute(stmt)
        existing = result.scalars().all()
        
        # Check if there is already a default guideline
        has_default = any(g.is_default for g in existing)
        
        if not has_default:
            print("Seeding default guideline...")
            default_content = "Please provide GitHub repository URL link containing your technical task."
            guideline = Guideline(
                id=UUIDHelper.generate_uuid7(),
                content=default_content,
                is_default=True
            )
            session.add(guideline)
            await session.commit()
            print("Seeding default guideline successful.")
        else:
            print("Default guideline already exists. Skipping seed.")

if __name__ == "__main__":
    asyncio.run(main())
