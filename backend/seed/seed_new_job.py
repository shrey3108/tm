import asyncio
import sys
from pathlib import Path

from sqlalchemy import delete, insert, select

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.v1.core.embeddings import embedding_service
from app.v1.db import Job, Skill, job_skills
from app.v1.db.session import async_session_maker, init_db
from app.v1.utils.text import build_job_text
from seed.seed_departments import ensure_department
from seed.seed_for_user import ensure_dev_test_role, ensure_user, get_admin_role
from seed.seed_skills import ensure_skills

JOB_TITLE = "Intermediate Next.js Developer"
JOB_DEPARTMENT = "Engineering"
JOB_LOCATION = "Remote"
JOB_CREATOR_EMAIL = "utsav@gmail.com"


JOB_DESCRIPTION = """This is a remote position.


About August Infotech,
By leveraging user-centric thinking, design capabilities, new technologies and cloud solutions,
we empower our clients and allow them to rethink how they connect with their customers across
every platform, every device and every step of the customer journey. As part of an end-to-end
delivery, our technical team builds compelling digital experiences with a focus on channels such
as the web and mobile.


A Typical Day of an Intermediate Next.js Developer at August Infotech


As an Intermediate Developer, your day may include:
- Reviewing sprint tasks and daily stand-up discussions with the team.
- Collaborating with designers and backend developers to translate requirements into features.
- Building and maintaining Next.js and React-based web applications.
- Integrating headless CMS platforms such as Strapi with frontend applications.
- Working with REST APIs and ensuring clean, typed integrations using TypeScript.
- Writing clean, reusable components and maintaining code quality through peer reviews.
- Debugging UI issues, fixing cross-browser inconsistencies, and improving page performance.
- Contributing to SEO-friendly page structures, metadata management, and rendering strategies.
- Communicating progress and blockers with the team and project managers.
- Updating documentation and project tracking tools at end of day.


Requirements


Technical Responsibilities:
- Next.js application development using SSR, SSG, and CSR rendering patterns.
- Building reusable React components with clean, typed TypeScript code.
- Integration of headless CMS platforms (Strapi, WordPress headless, or similar).
- REST API consumption and frontend-backend data flow management.
- Implementing responsive, accessible UI using HTML5, CSS3, and utility-first frameworks.
- PostgreSQL or similar relational database awareness for API-driven data handling.
- Basic SEO implementation: meta tags, Open Graph, structured data, and sitemap management.
- Version control workflows using GitHub, GitLab, or Bitbucket.
- Participation in code reviews and adherence to team coding standards.


Qualifications and Skills:
- Bachelor's degree in Computer Science, Engineering, or equivalent experience.
- 2–4 years of hands-on experience in React.js and Next.js development.
- Solid understanding of JavaScript (ES6+) and TypeScript.
- Experience with headless CMS platforms, preferably Strapi.
- Working knowledge of relational databases (PostgreSQL, MySQL, or SQLite).
- Familiarity with Node.js for API integration or lightweight backend tasks.
- Understanding of SEO fundamentals in the context of Next.js applications.
- Good communication skills and ability to collaborate in an Agile team.
- Experience with Git-based version control and code management workflows.


Benefits
- Fully remote
- 5 Days Working
- Technical growth
- Practical use of Generative AI
- Monthly PMRS (Performance Management Review System)"""


JOB_JSON = {
    "company": "August Infotech",
    "title": JOB_TITLE,
    "department": JOB_DEPARTMENT,
    "employment_type": None,
    "work_mode": JOB_LOCATION,
    "summary": (
        "Intermediate frontend engineering role focused on building SEO-optimized "
        "Next.js applications integrated with headless CMS platforms like Strapi, "
        "within a collaborative Agile team environment."
    ),
    "responsibilities": [
        "Build and maintain Next.js applications using SSR, SSG, and CSR strategies.",
        "Develop reusable React components with TypeScript for clean, typed codebases.",
        "Integrate headless CMS platforms (Strapi, WordPress headless) with Next.js frontends.",
        "Consume REST APIs and manage frontend-backend data flow effectively.",
        "Implement responsive, SEO-friendly UIs using HTML5, CSS3, and Bootstrap or Tailwind.",
        "Collaborate in sprint planning, stand-ups, and code review cycles.",
        "Debug UI inconsistencies and optimize page performance and Core Web Vitals basics.",
        "Maintain code quality through documentation, version control, and peer reviews.",
    ],
    "requirements": {
        "experience_years": 2,
        "education": (
            "Bachelor's degree in Computer Science, Engineering, or equivalent experience"
        ),
        "must_have": [
            "Next.js",
            "React",
            "JavaScript",
            "TypeScript",
            "HTML5",
            "CSS3",
            "Strapi CMS",
            "REST API",
            "Node.js",
            "PostgreSQL",
            "Bootstrap",
            "GitHub",
            "GitLab",
            "SEO",
            "Agile",
        ],
        "nice_to_have": [
            "MySQL",
            "SQLite",
            "MongoDB",
            "WordPress",
            "Laravel",
            "PHP",
            "Stripe",
            "Storybook",
        ],
    },
    "benefits": [
        "Fully remote",
        "5 Days Working",
        "Technical growth",
        "Practical use of Generative AI",
        "Monthly PMRS (Performance Management Review System)",
    ],
}


REQUIRED_SKILLS = [
    "Next.js",
    "React",
    "JavaScript",
    "TypeScript",
    "HTML5",
    "CSS3",
    "Strapi CMS",
    "REST API",
    "Node.js",
    "PostgreSQL",
    "Bootstrap",
    "GitHub",
    "GitLab",
    "SEO",
    "Agile",
]


async def ensure_job(session, creator_id, skills: list[Skill]) -> Job:
    # Resolve or create the department FK
    department = await ensure_department(session, JOB_DEPARTMENT)
    from seed.seed_positions import ensure_position
    position = await ensure_position(session, "Intermediate Developer")

    job = (
        (
            await session.execute(
                select(Job).where(
                    Job.title == JOB_TITLE,
                    Job.created_by == creator_id,
                )
            )
        )
        .scalars()
        .first()
    )

    if job:
        job.department_id = department.id
        job.position_id = position.id
        job.jd_text = JOB_DESCRIPTION
        job.jd_json = JOB_JSON
        job.is_active = True
    else:
        job = Job(
            title=JOB_TITLE,
            department_id=department.id,
            position_id=position.id,
            jd_text=JOB_DESCRIPTION,
            jd_json=JOB_JSON,
            jd_embedding=None,
            created_by=creator_id,
            is_active=True,
        )
        session.add(job)
        await session.flush()


    job_text = build_job_text(job)
    job.jd_embedding = embedding_service.encode_jd(job_text) if job_text else None

    skill_ids = [skill.id for skill in skills if skill.name in REQUIRED_SKILLS]
    await session.execute(delete(job_skills).where(job_skills.c.job_id == job.id))
    if skill_ids:
        await session.execute(
            insert(job_skills),
            [{"job_id": job.id, "skill_id": skill_id} for skill_id in skill_ids],
        )

    await session.flush()
    return job


async def main():
    await init_db()
    async with async_session_maker() as session:
        admin_role = await get_admin_role(session)
        role = await ensure_dev_test_role(session, admin_role)
        user = await ensure_user(session, role)
        skills = await ensure_skills(session)
        job = await ensure_job(session, user.id, skills)
        await session.commit()
        print(f"Job ready: {job.title}")
        print(f"Created by: {JOB_CREATOR_EMAIL}")
        print(f"Required skills linked: {len(REQUIRED_SKILLS)}")


if __name__ == "__main__":
    asyncio.run(main())
