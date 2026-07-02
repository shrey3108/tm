
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
    },
    {
        "name": "Ethics & Confidence",
        "description": "Evaluate the candidate's ethics and confidence during the panel interview.",
        "prompt_text": """Evaluate the candidate's ethics and confidence during the panel interview.
Consider: Honesty in answering, owning up to mistakes or lack of knowledge, self-assurance without arrogance, and ethical considerations in problem-solving.
Scoring rubric:
- 1: Dishonest, overly defensive, or completely lacks confidence
- 2: Avoids taking responsibility or shows signs of arrogance
- 3: Acceptable ethics and confidence, but somewhat defensive or uncertain
- 4: Strong ethics and good confidence with minor gaps
- 5: Highly ethical, honest, takes extreme ownership, and exudes calm self-assurance"""
    },
    {
        "name": "Technical Skills",
        "description": "Evaluate technical skills relevant to the role during a panel interview.",
        "prompt_text": """Evaluate technical skills relevant to the role during a panel interview.
PAY SPECIAL ATTENTION to questions asked by the Technical Interviewer, Tech Lead, or CTO.
Consider: Relevance to job, Depth of knowledge, Problem-solving ability, Practical usage.
Scoring rubric:
- 1: Not relevant or very weak
- 2: Limited relevance or shallow knowledge
- 3: Meets basic requirements
- 4: Strong skills with minor gaps
- 5: Deep expertise and highly relevant"""
    },
    {
        "name": "Skill articulation",
        "description": "Evaluate the candidate's ability to articulate their skills clearly.",
        "prompt_text": """Evaluate the candidate's ability to articulate their skills clearly.
Consider: How well they explain their past projects, the tools they've used, their specific contributions, and avoiding buzzword dropping without substance.
Scoring rubric:
- 1: Incoherent, heavily relies on buzzwords without explaining actual contributions
- 2: Frequently unclear, struggles to explain how they used specific skills
- 3: Understandable but lacks depth when pressed on specific skills
- 4: Clear and structured articulation of skills with minor lapses
- 5: Highly articulate, structured, and completely transparent about their skill depth"""
    },
    {
        "name": "Detail-oriented thinking",
        "description": "Evaluate the candidate's detail-oriented thinking.",
        "prompt_text": """Evaluate the candidate's detail-oriented thinking.
Consider: Did they ask clarifying questions? Did they consider edge cases in technical or behavioral scenarios? Did their answers show a thorough understanding of the nuances involved?
Scoring rubric:
- 1: Misses crucial details, makes sweeping assumptions
- 2: Overlooks important edge cases, does not ask clarifying questions
- 3: Mentions some details but misses deeper nuances
- 4: Considers most edge cases and details with minor misses
- 5: Highly meticulous, consistently identifies edge cases and clarifies ambiguities"""
    },
    {
        "name": "Attitude & behavior",
        "description": "Evaluate the candidate's attitude and behavior throughout the panel interview.",
        "prompt_text": """Evaluate the candidate's attitude and behavior throughout the panel interview.
Consider: Respect towards all interviewers (both HR and Technical), verbal tone, receptiveness to feedback, and overall demeanor.
Scoring rubric:
- 1: Disrespectful, argumentative, or completely dismissive
- 2: Defensive when questioned or overly casual
- 3: Polite but somewhat guarded or rigid
- 4: Respectful, open to feedback, and pleasant
- 5: Exceptionally professional, warmly collaborative, and highly receptive to feedback"""
    },
    {
        "name": "Smartness (problem solving ability)",
        "description": "Evaluate the candidate's smartness and problem-solving ability.",
        "prompt_text": """Evaluate the candidate's smartness and problem-solving ability.
Consider: Quick thinking on their feet, logical approach to unexpected or tricky questions, breaking down complex problems, and finding creative solutions.
Scoring rubric:
- 1: Cannot break down problems, gives up easily
- 2: Struggles with unexpected questions, rigid thinking
- 3: Uses standard approaches but struggles with novel twists
- 4: Thinks logically and adapts well to tricky questions
- 5: Exceptionally sharp, breaks down complex problems effortlessly and creatively"""
    },
    {
        "name": "Positivity",
        "description": "Evaluate the candidate's positivity and optimism.",
        "prompt_text": """Evaluate the candidate's positivity and optimism.
Consider: How they talk about past failures, their approach to difficult challenges, enthusiasm for the role, and whether they maintain a constructive mindset under pressure.
Scoring rubric:
- 1: Highly negative, complains about past employers or teams
- 2: Focuses on roadblocks rather than solutions, lacks enthusiasm
- 3: Neutral demeanor, neither particularly positive nor negative
- 4: Constructive mindset, shows genuine enthusiasm
- 5: Highly optimistic, reframes failures as learnings, brings strong positive energy"""
    },
    {
        "name": "Professionalism",
        "description": "Evaluate the candidate's professionalism.",
        "prompt_text": """Evaluate the candidate's professionalism.
Consider: Communication style, appropriate language, courtesy, and maintaining composure during technical stress tests or panel pressure.
Scoring rubric:
- 1: Unprofessional language, highly inappropriate demeanor
- 2: Too casual, interrupts interviewers, or loses composure
- 3: Acceptable professionalism but lacks polish under pressure
- 4: Maintains strong composure and courtesy throughout
- 5: Exemplary professionalism, remains highly polished and respectful even under pressure"""
    },
    {
        "name": "Ability to take challenges",
        "description": "Evaluate the candidate's ability to take on challenges.",
        "prompt_text": """Evaluate the candidate's ability to take on challenges.
Consider: Willingness to tackle unfamiliar problems, past examples of overcoming significant hurdles, and eagerness to step out of their comfort zone.
Scoring rubric:
- 1: Actively avoids challenges, highly risk-averse
- 2: Hesitant to step out of comfort zone, relies only on familiar tools
- 3: Willing to face challenges if required, but lacks strong proactive examples
- 4: Shows strong history of tackling difficult problems
- 5: Highly driven by challenges, actively seeks out complex hurdles to solve"""
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
