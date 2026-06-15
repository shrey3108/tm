"""
Database session module.

This module provides the SQLAlchemy async engine, session maker,
and utility functions for database operations.
"""

import logging
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from github_code_evaluator.app.v1.core.config import settings
from github_code_evaluator.app.v1.db.base import Base  # noqa: F401

logger = logging.getLogger(__name__)

engine = create_async_engine(
    settings.database_url,
    echo=True,
    poolclass=NullPool,
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db():
    """Dependency for getting async database sessions.

    Yields:
        AsyncSession: An async database session.
    """
    async with async_session_maker() as session:
        yield session


async def init_db():
    """Initialize the database by creating all tables.

    This function creates all tables defined by SQLAlchemy models
    that inherit from the Base class.
    """
    # Import all models here so SQLAlchemy metadata
    # is aware of all tables before create_all is called
    import github_code_evaluator.app.v1.db  # noqa: F401

    logger.info("Creating database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        from sqlalchemy import text
        await conn.execute(text("ALTER TABLE role_weight_configs ADD COLUMN IF NOT EXISTS default_skills JSONB;"))
        await conn.execute(text("ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS job_position TEXT;"))
        await conn.execute(text("ALTER TABLE evaluation_reports ADD COLUMN IF NOT EXISTS architecture_score NUMERIC(3, 1);"))
        await conn.execute(text("ALTER TABLE evaluation_reports ADD COLUMN IF NOT EXISTS code_quality_score NUMERIC(3, 1);"))
        await conn.execute(text("ALTER TABLE evaluation_reports ADD COLUMN IF NOT EXISTS security_score NUMERIC(3, 1);"))
        await conn.execute(text("ALTER TABLE evaluation_reports ADD COLUMN IF NOT EXISTS extraordinary_score NUMERIC(3, 1);"))
    logger.info("Database tables created successfully")

    # Seed default categories
    from github_code_evaluator.app.v1.db.models.category import Category
    from sqlalchemy import select

    async with async_session_maker() as session:
        default_categories = {
            "correctness": {
                "weight": 0.50,
                "description": "Evaluates type safety, error handling, business logic flaws, missing validation, incorrect auth flow, race conditions, and correctness of algorithm logic."
            },
            "code_quality": {
                "weight": 0.0,
                "description": "Evaluates deeply nested conditions, long functions / class names, naming quality, duplicated logic, separation of concerns, reusable abstractions, and modularity."
            },
            "architecture": {
                "weight": 0.0,
                "description": "Evaluates folder structure, framework conventions, caching strategy, and async processing."
            },
            "security": {
                "weight": 0.0,
                "description": "Evaluates hardcoded secrets, SQL injection, vulnerable packages, outdated dependencies, missing authorization, and insecure password storage."
            },
            "performance": {
                "weight": 0.20,
                "description": "Evaluates N+1 queries, unnecessary loops, blocking operations, sync IO, large bundle sizes, caching, indexing, pagination, and time/space complexity (specifically algorithm logic and estimated time and space complexity, e.g. O(N), O(log N))."
            },
            "documentation": {
                "weight": 0.30,
                "description": "Evaluates README, setup guide, examples, docstrings, comments, and typed APIs."
            }
        }
        
        logger.info("Syncing default categories...")
        for name, data in default_categories.items():
            stmt = select(Category).where(Category.name == name)
            result = await session.execute(stmt)
            cat = result.scalar_one_or_none()
            if cat:
                cat.weight = data["weight"]
                cat.description = data["description"]
            else:
                cat = Category(
                    name=name,
                    weight=data["weight"],
                    description=data["description"]
                )
                session.add(cat)
        await session.commit()
        logger.info("Default categories synced successfully")

        # Seed default roles configurations
        from github_code_evaluator.app.v1.db.models.role_config import RoleWeightConfig
        from github_code_evaluator.app.v1.services.scoring import DEFAULT_WEIGHTS

        default_roles = {
            "Python AI Engineer": ["Python", "FastAPI", "LangChain", "LLMs", "RAG"],
            "Backend Engineer": ["Python", "PostgreSQL", "Docker", "Redis", "Celery", "REST APIs"],
            "Frontend Engineer": ["React", "TypeScript", "JavaScript", "HTML", "CSS", "TailwindCSS"],
            "Fullstack Developer": ["Python", "React", "FastAPI", "PostgreSQL", "Docker", "TypeScript"],
        }

        logger.info("Syncing default roles configuration...")
        for role_name, skills in default_roles.items():
            stmt = select(RoleWeightConfig).where(RoleWeightConfig.role_name == role_name)
            result = await session.execute(stmt)
            role_cfg = result.scalar_one_or_none()
            if role_cfg:
                if not role_cfg.default_skills:
                    role_cfg.default_skills = skills
            else:
                role_cfg = RoleWeightConfig(
                    role_name=role_name,
                    weights=DEFAULT_WEIGHTS,
                    default_skills=skills,
                    version=1
                )
                session.add(role_cfg)
        await session.commit()
        logger.info("Default roles configuration synced successfully")
