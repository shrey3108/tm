
import asyncio
import uuid
from app.v1.db.session import engine
from sqlalchemy import select, insert, delete, text
from app.v1.db.models.criteria import Criterion
from app.v1.db.models.stage_template_criteria import StageTemplateCriterion
from app.v1.db.models.stage_templates import StageTemplate

OFFICIAL_CRITERIA = [
    {
        "name": "Communication",
        "description": "Evaluate the candidate's communication skills: Clarity, structure, ability to explain complex ideas, and responsiveness.",
        "prompt_text": """Evaluate the candidate's communication skills. 
Consider: Clarity and coherence, Structure of answers, Ability to explain complex ideas, Use of examples, Responsiveness to questions.
Scoring rubric:
- 1: Incoherent, confusing, or unable to express ideas
- 2: Frequently unclear, disorganized, hard to follow
- 3: Understandable but lacks structure or clarity in parts
- 4: Clear and structured with minor lapses
- 5: Highly articulate, structured, and easy to understand with strong examples"""
    },
    {
        "name": "Cultural Fit",
        "description": "Evaluate cultural fit: Alignment with values (ownership, teamwork, growth mindset), attitude, adaptability.",
        "prompt_text": """Evaluate cultural fit using job description and candidate behavior.
Consider: Alignment with values (ownership, teamwork, growth mindset), Attitude and work ethic, Collaboration and adaptability, Willingness to learn, Adaptability.
Scoring rubric:
- 1: Clear misalignment or concerning behavior
- 2: Some misalignment or weak signals
- 3: Neutral or unclear fit
- 4: Good alignment with minor gaps
- 5: Strong alignment, clearly matches values and culture"""
    },
    {
        "name": "Profile Understanding",
        "description": "Evaluate how well the candidate understands their own experience and past work.",
        "prompt_text": """Evaluate how well the candidate understands their own experience.
Consider: Clarity in explaining past work, Depth of understanding, Ability to justify decisions, Consistency with resume.
Scoring rubric:
- 1: Cannot explain own work or shows contradictions
- 2: Superficial understanding, struggles with details
- 3: Basic understanding but lacks depth
- 4: Strong understanding with minor gaps
- 5: Deep understanding with clear ownership and insights"""
    },
    {
        "name": "Tech Stack",
        "description": "Evaluate technical skills relevant to the role based on Resume, Transcript, and JD.",
        "prompt_text": """Evaluate technical skills relevant to the role.
Consider: Relevance to job, Depth of knowledge, Problem-solving ability, Practical usage.
Scoring rubric:
- 1: Not relevant or very weak
- 2: Limited relevance or shallow knowledge
- 3: Meets basic requirements
- 4: Strong skills with minor gaps
- 5: Deep expertise and highly relevant"""
    },
    {
        "name": "Salary Alignment",
        "description": "Evaluate salary expectation alignment with the role and market.",
        "prompt_text": """Evaluate salary expectation alignment.
Consider: Expected vs role range, Experience level, Market alignment, Flexibility.
Scoring rubric:
- 1: Completely unrealistic or misaligned
- 2: Significantly misaligned
- 3: Slight mismatch but negotiable
- 4: Mostly aligned with minor deviation
- 5: Fully aligned with role and market"""
    }
]

async def seed():
    async with engine.begin() as conn:
        print("Wiping existing criteria for clean seed...")
        await conn.execute(delete(StageTemplateCriterion))
        await conn.execute(delete(Criterion))
        
        print("Seeding official criteria...")
        criteria_ids = []
        for data in OFFICIAL_CRITERIA:
            res = await conn.execute(
                insert(Criterion).values(
                    name=data["name"],
                    description=data["description"],
                    prompt_text=data["prompt_text"]
                ).returning(Criterion.id)
            )
            criteria_ids.append(res.scalar())
        
        print(f"Created {len(criteria_ids)} official criteria.")

        # Link to all templates for POC
        res = await conn.execute(select(StageTemplate.id))
        template_ids = [r[0] for r in res.fetchall()]
        
        links = []
        for tid in template_ids:
            for i, cid in enumerate(criteria_ids):
                links.append({
                    "template_id": tid,
                    "criterion_id": cid,
                    "is_active": True,
                    "default_weight": 20.0 if i < 5 else 0.0 # Equal weight for first 5, salary is extra
                })
        
        if links:
            await conn.execute(insert(StageTemplateCriterion), links)
        
        # --- NEW: Also update the default_config of the templates to include these criteria_ids ---
        # This ensures the enrichment logic we just added can find them.
        import json
        for tid in template_ids:
            # For this POC, we'll just put all official criteria in every template's default_config
            ids_json = json.dumps([str(cid) for cid in criteria_ids])
            await conn.execute(
                text("UPDATE stage_templates SET default_config = jsonb_set(COALESCE(default_config, '{}'::jsonb), '{criteria_ids}', :ids) WHERE id = :tid"),
                {"ids": ids_json, "tid": tid}
            )
        
        print(f"Linked {len(links)} criteria mappings and updated default_config for {len(template_ids)} templates.")

if __name__ == "__main__":
    asyncio.run(seed())
