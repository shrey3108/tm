"""Script to clean up leftover test data from failed test runs."""
import asyncio
from sqlalchemy import text
from app.v1.db.session import engine


async def cleanup():
    async with engine.begin() as conn:
        print("Cleaning up leftover test data...")

        # Find test roles
        result = await conn.execute(
            text("SELECT id, name FROM roles WHERE name LIKE 'Test Role %' OR name LIKE 'Role %'")
        )
        rows = result.fetchall()
        print(f"Found {len(rows)} test roles:")
        for row in rows:
            print(f"  id={row[0]}, name={row[1]}")

        # Clean in order of FK dependencies
        await conn.execute(text(
            "DELETE FROM candidate_test_paper_histories "
            "WHERE candidate_id IN (SELECT id FROM candidates WHERE email LIKE 'test_candidate%@example.com' OR email LIKE 'candidate_%@example.com')"
        ))
        await conn.execute(text(
            "DELETE FROM candidate_test_papers "
            "WHERE job_id IN (SELECT id FROM jobs WHERE title LIKE 'Test %')"
        ))
        await conn.execute(text(
            "DELETE FROM candidate_stages "
            "WHERE candidate_id IN (SELECT id FROM candidates WHERE email LIKE 'test_candidate%@example.com' OR email LIKE 'candidate_%@example.com')"
        ))
        await conn.execute(text(
            "DELETE FROM candidates WHERE email LIKE 'test_candidate%@example.com' OR email LIKE 'candidate_%@example.com'"
        ))
        await conn.execute(text(
            "DELETE FROM question_set_papers "
            "WHERE department_id IN (SELECT id FROM departments WHERE name LIKE 'Test Department %' OR name LIKE 'Dept %')"
        ))
        await conn.execute(text(
            "DELETE FROM job_skills WHERE job_id IN (SELECT id FROM jobs WHERE title LIKE 'Test %')"
        ))
        await conn.execute(text(
            "DELETE FROM job_stage_configs WHERE job_id IN (SELECT id FROM jobs WHERE title LIKE 'Test %')"
        ))
        await conn.execute(text(
            "DELETE FROM jobs WHERE title LIKE 'Test %'"
        ))
        await conn.execute(text(
            "DELETE FROM departments WHERE name LIKE 'Test Department %' OR name LIKE 'Dept %'"
        ))
        await conn.execute(text(
            "DELETE FROM job_positions WHERE name LIKE 'Test Level %' OR name LIKE 'Test Pos %' "
            "OR name LIKE 'Test MCQ Level %' OR name LIKE 'Test Duplicate Level %' OR name = 'Senior Dev'"
        ))
        # Delete audit_logs referencing these test users before deleting the users
        await conn.execute(text(
            "DELETE FROM audit_logs WHERE user_id IN ("
            "SELECT id FROM users WHERE email LIKE 'test_user%@example.com' OR email LIKE 'test_dup_user%@example.com' OR email LIKE 'user_%@example.com' OR email LIKE 'test_user_mcq%@example.com'"
            ")"
        ))
        await conn.execute(text(
            "DELETE FROM users WHERE email LIKE 'test_user%@example.com' OR email LIKE 'test_dup_user%@example.com' OR email LIKE 'user_%@example.com' OR email LIKE 'test_user_mcq%@example.com'"
        ))
        await conn.execute(text(
            "DELETE FROM roles WHERE name LIKE 'Test Role %' OR name LIKE 'Role %'"
        ))
        await conn.execute(text(
            "DELETE FROM skills WHERE name LIKE 'Skill %'"
        ))
        await conn.execute(text(
            "DELETE FROM stage_templates WHERE (name = 'Technical Practical Round' AND description = 'Practical') "
            "OR (name = 'Stage A' AND description = 'A') OR (name = 'Stage B' AND description = 'B')"
        ))

        print("Cleanup complete!")


asyncio.run(cleanup())
