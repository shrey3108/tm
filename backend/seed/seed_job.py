import asyncio

from sqlalchemy import delete, insert, select

from app.v1.core.embeddings import embedding_service
from app.v1.db import Job, Skill, job_skills
from app.v1.db.session import async_session_maker, init_db
from app.v1.services.stage_service import stage_service
from app.v1.utils.text import build_job_text
from seed.seed_departments import ensure_department
from seed.seed_for_user import ensure_dev_test_role, ensure_user, get_admin_role
from seed.seed_skills import ensure_skills

# --- Combined Job: Senior Full Stack Developer (Next.js & Python) ---
FULLSTACK_JOB_TITLE = "Senior Full Stack Developer (Next.js & Python)"
FULLSTACK_JOB_DESCRIPTION = """This is a remo

te position.

About August Infotech,
By leveraging user-centric thinking, design capabilities, new technologies and cloud solutions, we empower our clients and allow them to rethink how they connect with their customers across every platform, every device and every step of the customer journey. As part of an end-to-end delivery, our technical team builds compelling digital experiences with a focus on channels such as the web and mobile.

A Typical Day of a Senior Full Stack Developer at August Infotech
As a Senior Full Stack Developer, your day may include:
- Designing and implementing high-performance backend services using FastAPI and Python.
- Developing scalable, performant, and SEO-optimized web applications using Next.js, React, and modern frontend ecosystems.
- Architecting database schemas and optimizing complex SQL queries with PostgreSQL and SQLAlchemy.
- Collaborating with designers and stakeholders to align on requirements and technical specifications.
- Implementing SSR, SSG, ISR, and CSR rendering strategies for frontend excellence.
- Implementing asynchronous task processing and caching strategies using Redis.
- Integrating APIs, GraphQL, and headless CMS solutions with Next.js applications.
- Conducting code reviews, mentoring junior developers, and ensuring adherence to best practices across the stack.
- Debugging, optimizing performance (Lighthouse, Core Web Vitals), and ensuring responsive, cross-browser UI.
- Managing cloud deployments on AWS and overseeing CI/CD pipelines.
- Communicating with clients to provide updates, gather requirements, and suggest architectural improvements.

Requirements
Technical Responsibilities:
- Full-stack application development using Next.js (React) and FastAPI (Python).
- Backend architecture design, database migration, and optimization with PostgreSQL/SQLAlchemy.
- Front-end architecture design with SSR/SSG/ISR strategies and Tailwind CSS.
- API integration (REST/GraphQL/Headless CMS).
- Performance optimization (SEO, Core Web Vitals, Lighthouse scores, SQL tuning).
- Asynchronous programming and background task management.
- Deployment and orchestration using Docker and AWS infrastructure.
- Writing comprehensive unit and integration tests with Pytest and Jest/Cypress.
- Code quality, security best practices, and technical documentation.

Management and Leadership Responsibilities:
- Mentor junior and intermediate developers across frontend and backend domains.
- Participate in hiring and technical interviews.
- Lead architectural discussions and contribute to the project roadmap.
- Promote best practices in software engineering and encourage innovation.

Qualifications and Skills:
- Bachelor's degree in Computer Science, Engineering, or equivalent experience.
- 5+ years of hands-on experience in full-stack development.
- Deep expertise in React.js, Next.js, Python 3.11+, and FastAPI.
- Strong knowledge of TypeScript, JavaScript (ES6+), HTML5, and CSS3.
- Strong understanding of relational databases (PostgreSQL) and SQL optimization.
- Proficiency with Docker, Redis, and cloud infrastructure (AWS/Vercel).
- Excellent problem-solving, debugging, and communication skills.
- Familiarity with Agile and Scrum methodologies.

Benefits
- Fully remote
- 5 Days Working
- Technical growth
- Practical use of Generative AI
- Monthly PMRS (Performance Management Review System)"""

FULLSTACK_JOB_JSON = {
    "company": "August Infotech",
    "title": FULLSTACK_JOB_TITLE,
    "department": "Engineering",
    "employment_type": "Full-time",
    "work_mode": "Remote",
    "summary": (
        "Senior full-stack role focused on architecting and building end-to-end "
        "solutions using Next.js for the frontend and FastAPI/Python for the backend, "
        "while leading technical teams and optimizing cloud infrastructure."
    ),
    "responsibilities": [
        "Develop scalable Next.js applications with SSR/SSG/ISR strategies.",
        "Design and build performant backend APIs with FastAPI and Python.",
        "Architect and optimize database solutions with PostgreSQL and SQLAlchemy.",
        "Integrate REST APIs, GraphQL services, and headless CMS solutions.",
        "Mentor developers, lead code reviews, and enforce engineering best practices.",
        "Optimize Core Web Vitals, SEO, and application performance across the stack.",
        "Manage cloud deployments on AWS/Vercel and oversee CI/CD workflows.",
    ],
    "requirements": {
        "experience_years": 5,
        "education": "Bachelor's degree in Computer Science, Engineering, or equivalent experience",
        "must_have": [
            "Next.js",
            "React",
            "Python",
            "FastAPI",
            "TypeScript",
            "PostgreSQL",
            "SQLAlchemy",
            "Tailwind CSS",
            "Docker",
            "Redis",
            "AWS",
            "REST API",
            "CI/CD",
            "JavaScript",
            "HTML5",
            "CSS3",
            "Git",
        ],
        "nice_to_have": [
            "GraphQL",
            "Headless CMS",
            "Redux",
            "Jest",
            "Pytest",
            "Cypress",
            "Vercel",
            "Agile",
            "Scrum",
            "SQL",
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

FULLSTACK_REQUIRED_SKILLS = [
    "Next.js",
    "React",
    "Python",
    "FastAPI",
    "TypeScript",
    "PostgreSQL",
    "SQLAlchemy",
    "Tailwind CSS",
    "Docker",
    "Redis",
    "AWS",
    "REST API",
    "CI/CD",
    "JavaScript",
    "HTML5",
    "CSS3",
    "Git",
    "GraphQL",
    "Headless CMS",
    "Redux",
    "Jest",
    "Pytest",
    "Cypress",
    "Vercel",
    "Agile",
    "Scrum",
    "SQL",
]

JOBS_TO_SEED = [
    {
        "title": FULLSTACK_JOB_TITLE,
        "description": FULLSTACK_JOB_DESCRIPTION,
        "json": FULLSTACK_JOB_JSON,
        "required_skills": FULLSTACK_REQUIRED_SKILLS,
        "department": "Engineering",
    }
]


async def ensure_job(
    session, creator_id, skills: list[Skill], job_config: dict
) -> Job:
    title = job_config["title"]
    description = job_config["description"]
    job_json = job_config["json"]
    required_skills = job_config["required_skills"]
    department_name = job_config["department"]

    # Resolve or create the department FK
    department = await ensure_department(session, department_name)
    from seed.seed_positions import ensure_position
    position = await ensure_position(session, "Senior Developer")

    job = (
        (
            await session.execute(
                select(Job).where(
                    Job.title == title,
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
        job.jd_text = description
        job.jd_json = job_json
        job.is_active = True
    else:
        job = Job(
            title=title,
            department_id=department.id,
            position_id=position.id,
            jd_text=description,
            jd_json=job_json,
            jd_embedding=None,
            created_by=creator_id,
            is_active=True,
        )

        session.add(job)
        await session.flush()

    job_text = build_job_text(job)
    job.jd_embedding = embedding_service.encode_jd(job_text) if job_text else None

    # Link skills
    skill_ids = [skill.id for skill in skills if skill.name in required_skills]
    await session.execute(
        delete(job_skills).where(job_skills.c.job_id == job.id)
    )
    if skill_ids:
        await session.execute(
            insert(job_skills),
            [
                {"job_id": job.id, "skill_id": skill_id}
                for skill_id in skill_ids
            ],
        )

    # Initialize dynamic stages if not already present
    from app.v1.repository.stage_repository import stage_repository

    existing_stages = await stage_repository.get_job_stages(session, job.id)
    if not existing_stages:
        await stage_service.setup_default_stages(session, job.id)

    await session.flush()
    return job


async def main():
    await init_db()

    async with async_session_maker() as session:
        admin_role = await get_admin_role(session)
        role = await ensure_dev_test_role(session, admin_role)
        user = await ensure_user(session, role)

        # Ensure stage templates are seeded for dynamic stages
        from seed.seed_stages import ensure_stages

        await ensure_stages(session)

        skills = await ensure_skills(session)

        for job_config in JOBS_TO_SEED:
            job = await ensure_job(session, user.id, skills, job_config)
            print(f"Job ready: {job.title}")

        await session.commit()
        print("Seeding completed successfully.")


if __name__ == "__main__":
    asyncio.run(main())
