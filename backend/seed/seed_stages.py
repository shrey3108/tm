import asyncio

from sqlalchemy import select

from app.v1.db.models.stage_templates import StageTemplate
from app.v1.db.session import async_session_maker, init_db

STAGE_TEMPLATES = [
    {
        "name": "Resume Screening",
        "description": "Initial automated screening of the resume against the job description and required skills.",
        "is_default": True,
        "default_order": 1,
        "default_config": {
            "evaluation_criteria": [
                "Overall Fit",
                "Skills Match",
                "Experience Match"
            ],
        },
    },
    {
        "name": "HR Screening Round",
        "description": "Initial HR call to evaluate communication, confidence, and cultural fit.",
        "is_default": True,
        "default_order": 2,
        "default_config": {
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
        "is_default": True,
        "default_order": 3,
        "default_config": {
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
        "is_default": True,
        "default_order": 4,
        "default_config": {
            "is_panel_interview": True,
            "evaluation_criteria": [
                "Ethics & Confidence",
                "Technical Skills",
                "Skill articulation",
                "Detail-oriented thinking",
                "Attitude & behavior",
                "Smartness (problem solving ability)",
                "Positivity",
                "Professionalism",
                "Ability to take challenges",
            ],
        },
    },
    {
        "name": "CTO Interview",
        "description": "Strategic leadership and architecture discussion for senior positions.",
        "default_config": {
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
            if "is_default" in template_data:
                existing.is_default = template_data["is_default"]
            if "default_order" in template_data:
                existing.default_order = template_data["default_order"]
            templates.append(existing)
            continue

        template = StageTemplate(
            name=name,
            description=template_data["description"],
            default_config=template_data["default_config"],
            is_default=template_data.get("is_default", False),
            default_order=template_data.get("default_order", None),
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
