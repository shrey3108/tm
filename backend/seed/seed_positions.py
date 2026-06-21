"""
Helper to seed and resolve JobPosition records.
"""
import asyncio
import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from app.v1.db.models.job_positions import JobPosition
from app.v1.db.session import async_session_maker, init_db
from app.v1.utils.uuid import UUIDHelper

async def ensure_position(session, name: str) -> JobPosition:
    """Get or create a JobPosition by name.

    Args:
        session: SQLAlchemy async session.
        name: Position name (unique).

    Returns:
        The existing or newly created JobPosition ORM object.
    """
    existing = (
        await session.execute(select(JobPosition).where(JobPosition.name == name))
    ).scalar_one_or_none()

    if existing:
        return existing

    pos = JobPosition(
        id=UUIDHelper.generate_uuid7(),
        name=name,
    )
    session.add(pos)
    await session.flush()
    return pos


async def main():
    await init_db()
    async with async_session_maker() as session:
        print("Seeding default positions...")
        positions = ["Junior Developer", "Intermediate Developer", "Senior Developer"]
        for name in positions:
            pos = await ensure_position(session, name)
            print(f"Position: {pos.name} ready.")
        await session.commit()
        print("Positions seeding completed.")

if __name__ == "__main__":
    asyncio.run(main())
