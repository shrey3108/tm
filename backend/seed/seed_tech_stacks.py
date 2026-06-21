"""
Helper to seed and resolve TechStack records.
"""
import asyncio
import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from app.v1.db.models.tech_stacks import TechStack
from app.v1.db.session import async_session_maker, init_db
from app.v1.utils.uuid import UUIDHelper

async def ensure_tech_stack(session, name: str, description: str | None = None) -> TechStack:
    """Get or create a TechStack by name.

    Args:
        session: SQLAlchemy async session.
        name: TechStack name (unique).
        description: Optional description.

    Returns:
        The existing or newly created TechStack ORM object.
    """
    existing = (
        await session.execute(select(TechStack).where(TechStack.name == name))
    ).scalar_one_or_none()

    if existing:
        if description and existing.description != description:
            existing.description = description
            await session.flush()
        return existing

    tech = TechStack(
        id=UUIDHelper.generate_uuid7(),
        name=name,
        description=description,
    )
    session.add(tech)
    await session.flush()
    return tech


async def main():
    await init_db()
    async with async_session_maker() as session:
        print("Seeding default tech stacks...")
        tech_stacks = [
            ("Python / FastAPI", "FastAPI backend stack with Python"),
            ("Node.js / Express", "Express framework backend with JavaScript/TypeScript"),
            ("React / Frontend", "Frontend library for building user interfaces"),
            ("Python / Django", "High-level Python web framework"),
            ("Java / Spring Boot", "Production-ready enterprise framework for Java"),
        ]
        for name, desc in tech_stacks:
            tech = await ensure_tech_stack(session, name, desc)
            print(f"TechStack: {tech.name} ready.")
        await session.commit()
        print("Tech stacks seeding completed.")

if __name__ == "__main__":
    asyncio.run(main())
