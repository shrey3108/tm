import asyncio

from sqlalchemy import select

from app.v1.db.models.criteria import Criterion
from app.v1.db.models.stage_template_criteria import StageTemplateCriterion
from app.v1.db.models.stage_templates import StageTemplate
from app.v1.db.session import async_session_maker, init_db

STAGE_TEMPLATES = [
    {
        "name": "HR Screening Round",
        "description": "Initial HR call to evaluate communication, confidence, and cultural fit.",
        "default_config": {
            "type": "audio",
        },
        "evaluation_criteria": [
            "Communication skill",
            "Confidence",
            "Cultural fit",
            "Profile understanding",
            "Tech-stack alignment",
            "Salary alignment",
        ],
    },
    {
        "name": "Technical Practical Round",
        "description": "Video-based round evaluating coding tasks, system design, and practical implementation.",
        "default_config": {
            "type": "video",
        },
        "evaluation_criteria": [
            "Problem-solving ability",
            "Logical thinking",
            "Code structure clarity",
            "Debug approach",
            "Implementation accuracy",
        ],
    },
    {
        "name": "Technical + HR Panel Evaluation",
        "description": "Final panel interview focusing on technical depth and behavioral attributes.",
        "default_config": {
            "type": "audio",
        },
        "evaluation_criteria": [
            "Ethics & Confidence",
            "Technical Skills",
            "Skill articulation",
            "Detail-oriented thinking",
            "Attitude & behavior",
            "Professionalism",
        ],
    },
    {
        "name": "CTO Interview",
        "description": "Strategic leadership and architecture discussion for senior positions.",
        "default_config": {
            "type": "audio",
        },
        "evaluation_criteria": [
            "Strategic thinking",
            "System architecture ability",
            "Leadership capability",
            "Ownership mindset",
        ],
    },
]


async def ensure_stages(session) -> list[StageTemplate]:
    """Ensure standard stage templates and criteria exist in the database."""
    # 1. Fetch existing templates
    result = await session.execute(select(StageTemplate))
    existing_templates = {t.name: t for t in result.scalars().all()}
    
    # 2. Fetch existing criteria 
    crit_result = await session.execute(select(Criterion))
    existing_criteria = {c.name.lower(): c for c in crit_result.scalars().all()}

    templates = []
    
    for template_data in STAGE_TEMPLATES:
        name = template_data["name"]
        template = existing_templates.get(name)

        if template:
            # Update existing template config
            template.description = template_data["description"]
            template.default_config = template_data["default_config"]
            templates.append(template)
        else:
            # Create new template
            template = StageTemplate(
                name=name,
                description=template_data["description"],
                default_config=template_data["default_config"],
            )
            session.add(template)
            templates.append(template)
            await session.flush() # Need ID for mapping

        # Ensure criteria exist and create mappings
        criteria_names = template_data.get("evaluation_criteria", [])
        num_criteria = len(criteria_names)
        
        # Determine default equal weight for this template
        default_weight = 100.0 / num_criteria if num_criteria > 0 else 0.0

        for crit_name in criteria_names:
            # Check or create Criterion
            crit_lower = crit_name.lower()
            criterion = existing_criteria.get(crit_lower)
            
            if not criterion:
                criterion = Criterion(name=crit_name, description=f"Evaluate {crit_name}")
                session.add(criterion)
                await session.flush()
                existing_criteria[crit_lower] = criterion
                
            # Create/update mapping in StageTemplateCriterion
            mapping_check = await session.execute(
                 select(StageTemplateCriterion).where(
                     StageTemplateCriterion.template_id == template.id,
                     StageTemplateCriterion.criterion_id == criterion.id
                 )
            )
            mapping = mapping_check.scalar_one_or_none()
            
            if not mapping:
                mapping = StageTemplateCriterion(
                    template_id=template.id,
                    criterion_id=criterion.id,
                    is_active=True,
                    default_weight=default_weight
                )
                session.add(mapping)
            else:
                 # Update weight if it changed
                 mapping.default_weight = default_weight

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
