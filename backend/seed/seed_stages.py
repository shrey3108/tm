import asyncio

from sqlalchemy import select

from app.v1.db.models.stage_templates import StageTemplate
from app.v1.db.session import async_session_maker, init_db

STAGE_TEMPLATES = [
    {
        "name": "HR Screening Round",
        "description": "Initial HR call to evaluate communication, confidence, and cultural fit.",
        "default_config": {
            "type": "audio",
            "evaluation_criteria": [
                "Communication skill",
                "Confidence",
                "Cultural fit",
                "Profile understanding",
                "Tech-stack alignment",
                "Salary alignment",
            ],
        },
    },
    {
        "name": "Technical Practical Round",
        "description": "Video-based round evaluating coding tasks, system design, and practical implementation.",
        "default_config": {
            "type": "video",
            "evaluation_criteria": [
                "performance",
                "architecture",
                "code_quality",
                "correctness",
                "security",
                "documentation",
            ],
        },
    },
    {
        "name": "Technical + HR Panel Evaluation",
        "description": "Final panel interview focusing on technical depth and behavioral attributes.",
        "default_config": {
            "type": "audio",
            "evaluation_criteria": [
                "Ethics & Confidence",
                "Technical Skills",
                "Skill articulation",
                "Detail-oriented thinking",
                "Attitude & behavior",
                "Professionalism",
            ],
        },
    },
    {
        "name": "CTO Interview",
        "description": "Strategic leadership and architecture discussion for senior positions.",
        "default_config": {
            "type": "audio",
            "evaluation_criteria": [
                "Strategic thinking",
                "System architecture ability",
                "Leadership capability",
                "Ownership mindset",
            ],
        },
    },
]


async def ensure_stages(session) -> list[StageTemplate]:
    """Ensure standard stage templates exist in the database."""
    result = await session.execute(select(StageTemplate))
    existing_templates = {t.name: t for t in result.scalars().all()}

    templates = []
    for template_data in STAGE_TEMPLATES:
        name = template_data["name"]
        existing = existing_templates.get(name)

        if existing:
            # Update existing template if description or config changed
            existing.description = template_data["description"]
            existing.default_config = template_data["default_config"]
            templates.append(existing)
            continue

        template = StageTemplate(
            name=name,
            description=template_data["description"],
            default_config=template_data["default_config"],
        )
        session.add(template)
        templates.append(template)

    await session.flush()
    return templates


async def main():
    await init_db()
    async with async_session_maker() as session:
        templates = await ensure_stages(session)
        await session.commit()
        print(f"Seeded {len(templates)} stage templates successfully!")
        for t in templates:
            print(f"  - {t.name}")


if __name__ == "__main__":
    asyncio.run(main())
