import asyncio
import sys
from pathlib import Path

from sqlalchemy import delete, insert, select

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.v1.core.embeddings import embedding_service
from app.v1.db import Job, Skill, job_skills
from app.v1.db.session import async_session_maker, init_db
from app.v1.services.stage_service import stage_service
from app.v1.utils.text import build_job_text
from seed.seed_departments import ensure_department
from seed.seed_for_user import ensure_dev_test_role, ensure_user, get_admin_role
from seed.seed_skills import ensure_skills

JOB_TITLE = "Frontend Developer (React & Next.js)"
JOB_DEPARTMENT = "Product Engineering"
JOB_LOCATION = "Remote / Hybrid"
JOB_CREATOR_EMAIL = "utsav@gmail.com"

JOB_DESCRIPTION = """
Join our dynamic engineering team as a Frontend Developer specializing in React and Next.js. You will be responsible for building high-quality, scalable web applications that deliver exceptional user experiences.

Key Responsibilities:
- Develop new user-facing features using React.js and Next.js.
- Build reusable components and frontend libraries for future use.
- Optimize applications for maximum speed and scalability.
- Collaborate with back-end developers and web designers to improve usability.
- Ensure the technical feasibility of UI/UX designs.
- Write clean, maintainable, and well-documented code using TypeScript.
- Implement responsive design and ensure cross-browser compatibility.
- Stay up-to-date with the latest industry trends and technologies.

Requirements:
- 3+ years of professional experience in frontend development.
- Strong proficiency in JavaScript, including DOM manipulation and the JavaScript object model.
- Thorough understanding of React.js and its core principles.
- Experience with Next.js (SSR, SSG, ISR).
- Experience with popular React.js workflows (such as Redux or Context API).
- Familiarity with newer specifications of EcmaScript.
- Experience with data structure libraries (e.g., Immutable.js).
- Knowledge of isomorphic React is a plus.
- Familiarity with RESTful APIs and GraphQL.
- Knowledge of modern authorization mechanisms, such as JSON Web Token.
- Familiarity with modern frontend build pipelines and tools.
- Experience with common frontend development tools such as Babel, Webpack, NPM, etc.
- Ability to understand business requirements and translate them into technical requirements.
- A knack for benchmarking and optimization.
- Familiarity with code versioning tools (Git).

Preferred Skills:
- Experience with Tailwind CSS or CSS Modules.
- Familiarity with testing frameworks like Jest or Cypress.
- Basic understanding of Node.js for server-side logic.
"""

JOB_JSON = {
    "company": "Hiring Platform AI",
    "title": JOB_TITLE,
    "department": JOB_DEPARTMENT,
    "work_mode": JOB_LOCATION,
    "summary": "Build high-quality, scalable web applications using React and Next.js with a focus on performance and UX.",
    "responsibilities": [
        "Develop user-facing features with React and Next.js.",
        "Build reusable components and frontend libraries.",
        "Optimize for speed and scalability.",
        "Collaborate with backend and design teams.",
        "Ensure UI/UX technical feasibility.",
        "Maintain code quality and documentation.",
    ],
    "requirements": {
        "experience_years": 3,
        "education": "Bachelor's degree in CS or equivalent experience.",
        "must_have": [
            "React",
            "Next.js",
            "JavaScript",
            "TypeScript",
            "HTML5",
            "CSS3",
            "REST API",
            "Git",
        ],
        "nice_to_have": [
            "Tailwind CSS",
            "GraphQL",
            "Redux",
            "Jest",
            "Cypress",
            "Node.js",
        ],
    },
}

REQUIRED_SKILLS = [
    "React",
    "Next.js",
    "JavaScript",
    "TypeScript",
    "HTML5",
    "CSS3",
    "REST API",
    "Git",
    "Tailwind CSS",
    "GraphQL",
    "Redux",
    "Jest",
    "Cypress",
    "Node.js",
]


async def ensure_job(session, creator_id, skills: list[Skill]) -> Job:
    # Resolve or create the department FK
    department = await ensure_department(session, JOB_DEPARTMENT)
    from seed.seed_positions import ensure_position
    position = await ensure_position(session, "Intermediate Developer")

    # Check if job already exists
    stmt = select(Job).where(
        Job.title == JOB_TITLE, Job.created_by == creator_id
    )
    result = await session.execute(stmt)
    job = result.scalars().first()

    if job:
        job.department_id = department.id
        job.position_id = position.id
        job.jd_text = JOB_DESCRIPTION
        job.jd_json = JOB_JSON
        job.vacancy = 5
        job.is_active = True
    else:
        job = Job(
            title=JOB_TITLE,
            department_id=department.id,
            position_id=position.id,
            jd_text=JOB_DESCRIPTION,
            jd_json=JOB_JSON,
            vacancy=5,
            created_by=creator_id,
            is_active=True,
        )
        session.add(job)
        await session.flush()


    # Update embedding
    job_text = build_job_text(job)
    job.jd_embedding = embedding_service.encode_jd(job_text) if job_text else None

    # Sync skills
    skill_ids = [skill.id for skill in skills if skill.name in REQUIRED_SKILLS]
    await session.execute(
        delete(job_skills).where(job_skills.c.job_id == job.id)
    )
    if skill_ids:
        await session.execute(
            insert(job_skills),
            [{"job_id": job.id, "skill_id": sid} for sid in skill_ids],
        )

    # Setup Dynamic Stages (Demonstrating the new functionality)
    # First, clear existing stages if any (to allow re-seeding)
    from app.v1.repository.stage_repository import stage_repository

    await stage_repository.clear_job_stages(session, job.id)

    # Use stage_service to setup standard flow
    await stage_service.setup_default_stages(session, job.id)

    await session.flush()
    return job


async def main():
    await init_db()
    async with async_session_maker() as session:
        admin_role = await get_admin_role(session)
        role = await ensure_dev_test_role(session, admin_role)
        user = await ensure_user(session, role)

        # Ensure we have stage templates seeded first
        from seed.seed_stages import ensure_stages

        await ensure_stages(session)

        skills = await ensure_skills(session)
        job = await ensure_job(session, user.id, skills)

        await session.commit()
        print(f"Seeded Job: {job.title}")
        print(f"Dynamic stages initialized for: {job.title}")


if __name__ == "__main__":
    asyncio.run(main())
