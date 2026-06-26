import pytest
import uuid
import random
import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient
from sqlalchemy import select, delete, text
from app.main import app
from app.v1.db.session import engine
from app.v1.db.models.user import User
from app.v1.db.models.jobs import Job
from app.v1.db.models.job_positions import JobPosition
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.question_set_paper import QuestionSetPaper
from app.v1.db.models.candidate_test_paper import CandidateTestPaper
from app.v1.schemas.user import UserRead
from app.v1.dependencies.auth import get_current_user
from app.v1.utils.uuid import UUIDHelper


@pytest.mark.anyio
async def test_task_papers_flow():
    # 1. Setup mock records
    test_id_suffix = str(UUIDHelper.generate_uuid7())[:8]
    job_title = f"Test Software Engineer {test_id_suffix}"
    position_name = f"Test Level {test_id_suffix}"
    candidate_email = f"test_candidate_{test_id_suffix}@example.com"
    user_email = f"test_user_{test_id_suffix}@example.com"

    async with engine.begin() as conn:
        # Create role
        role_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO roles (id, name, created_at, updated_at) "
                "VALUES (:id, :name, NOW(), NOW())"
            ),
            {"id": role_id, "name": f"Test Role {test_id_suffix}"},
        )

        # Create user
        user_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO users (id, email, password_hash, role_id, is_active, created_at, updated_at) "
                "VALUES (:id, :email, 'hash', :role_id, true, NOW(), NOW())"
            ),
            {"id": user_id, "email": user_email, "role_id": role_id},
        )

        # Create department
        department_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO departments (id, name, description) "
                "VALUES (:id, :name, 'Test Department')"
            ),
            {"id": department_id, "name": f"Test Department {test_id_suffix}"},
        )

        # Select or insert FastAPI, Python, Asyncio skills
        skill_names = ["FastAPI", "Python", "Asyncio"]
        job_skill_ids = []
        created_skill_ids = []
        for name in skill_names:
            res_skill = await conn.execute(
                text("SELECT id FROM skills WHERE name = :name"),
                {"name": name}
            )
            row = res_skill.fetchone()
            if row:
                skill_id = row[0]
            else:
                skill_id = UUIDHelper.generate_uuid7()
                await conn.execute(
                    text("INSERT INTO skills (id, name, description) VALUES (:id, :name, 'Test Skill Description')"),
                    {"id": skill_id, "name": name}
                )
                created_skill_ids.append(skill_id)
            job_skill_ids.append(skill_id)

        # Create position level
        position_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO job_positions (id, name, created_at, updated_at) "
                "VALUES (:id, :name, NOW(), NOW())"
            ),
            {"id": position_id, "name": position_name},
        )

        # Create job linked to position level and department
        job_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO jobs (id, title, department_id, position_id, is_active, passing_threshold, version, created_at) "
                "VALUES (:id, :title, :department_id, :position_id, true, 70.0, 1, NOW())"
            ),
            {"id": job_id, "title": job_title, "department_id": department_id, "position_id": position_id},
        )

        # Link job to skills
        for skill_id in job_skill_ids:
            await conn.execute(
                text(
                    "INSERT INTO job_skills (job_id, skill_id) "
                    "VALUES (:job_id, :skill_id)"
                ),
                {"job_id": job_id, "skill_id": skill_id},
            )

        # Create candidate linked to job
        candidate_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO candidates (id, first_name, last_name, email, applied_job_id, created_at) "
                "VALUES (:id, 'John', 'Doe', :email, :job_id, NOW())"
            ),
            {"id": candidate_id, "email": candidate_email, "job_id": job_id},
        )

        # Create Stage Template for Technical Practical Round
        template_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO stage_templates (id, name, description, default_config, created_at) "
                "VALUES (:id, 'Technical Practical Round', 'Practical', '{}', NOW())"
            ),
            {"id": template_id},
        )

        # Create JobStageConfig
        job_stage_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO job_stage_configs (id, job_id, template_id, stage_order, is_default, config, is_mandatory, created_at) "
                "VALUES (:id, :job_id, :template_id, 1, false, '{}', true, NOW())"
            ),
            {"id": job_stage_id, "job_id": job_id, "template_id": template_id},
        )

        # Create CandidateStage (currently active/pending, status='active')
        candidate_stage_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO candidate_stages (id, candidate_id, job_stage_id, status, started_at) "
                "VALUES (:id, :candidate_id, :job_stage_id, 'active', NOW())"
            ),
            {"id": candidate_stage_id, "candidate_id": candidate_id, "job_stage_id": job_stage_id},
        )


    # 2. Mock authentication
    mock_user = UserRead(
        id=user_id,
        email=user_email,
        is_active=True,
        is_superuser=True,
        first_name="Test",
        last_name="User",
        role_id=role_id,
        role_name=f"Test Role {test_id_suffix}",
        permissions=["candidates:decide", "candidates:access", "admin:all"],
    )
    app.dependency_overrides[get_current_user] = lambda: mock_user
    client = TestClient(app)

    try:
        with patch("app.v1.routes.task_papers_email.send_candidate_task_email_via_smtp") as mock_send_email:

            # 3. Create question set papers via POST /manual
            # Manual Paper A
            data_a = {
                "department_id": str(department_id),
                "position_id": str(position_id),
                "skill_ids": [str(sid) for sid in job_skill_ids],
                "paper_type": "mixed",
                "questions": [
                    "Explain python generators.",
                    "What is GIL?",
                    "How decorators work?",
                    "Explain python list comprehension.",
                    "Explain python type hints.",
                ],
                "mcqs": [],
                "project_task": [{"task": "Build a REST API with FastAPI.", "instructions": "Build it using clean architecture and proper testing."}]
            }
            response = client.post("/api/v1/task-papers/manual", json=data_a)
            assert response.status_code == 201
            paper_a = response.json()
            paper_a_id = paper_a["id"]
            assert paper_a["name"].startswith("Custom Paper - ")
            assert [q["question"] for q in paper_a["questions"]] == data_a["questions"]
            assert len(paper_a["project_task"]) == 1

            # Manual Paper B
            data_b = {
                "department_id": str(department_id),
                "position_id": str(position_id),
                "skill_ids": [str(sid) for sid in job_skill_ids],
                "paper_type": "mixed",
                "questions": [
                    "What is asyncio?",
                    "How does multithreading differ from multiprocessing in Python?",
                    "What are metaclasses?",
                    "How do you handle memory management in Python?",
                    "Explain __slots__.",
                ],
                "mcqs": [],
                "project_task": [{"task": "Implement a task runner in Python.", "instructions": "Build it using clean architecture and proper testing."}]
            }
            response = client.post("/api/v1/task-papers/manual", json=data_b)
            assert response.status_code == 201
            paper_b = response.json()
            paper_b_id = paper_b["id"]
            assert paper_b["name"].startswith("Custom Paper - ")
            assert [q["question"] for q in paper_b["questions"]] == data_b["questions"]
            assert len(paper_b["project_task"]) == 1

            # 4. List question set papers
            # GET /api/v1/task-papers
            response = client.get("/api/v1/task-papers")
            assert response.status_code == 200
            matching_papers = [p for p in response.json()["data"] if p["department_id"] == str(department_id)]
            assert len(matching_papers) == 2

            # GET /api/v1/task-papers?department_id=...
            response = client.get(f"/api/v1/task-papers?department_id={department_id}")
            assert response.status_code == 200
            assert len(response.json()["data"]) == 2

            # GET /api/v1/task-papers/{paper_id}
            response = client.get(f"/api/v1/task-papers/{paper_a_id}")
            assert response.status_code == 200
            assert response.json()["name"].startswith("Custom Paper - ")

            # Test sending email before any paper is assigned returns 404
            email_payload = {
                "candidate_email": candidate_email,
                "paper_id": str(UUIDHelper.generate_uuid7()),
            }
            response = client.post(
                "/api/v1/task-papers/send-email",
                json=email_payload,
            )
            assert response.status_code == 404
            assert "not found" in response.json()["detail"]

            # 5. Assign predefined paper to candidate
            assign_predefined_payload = {
                "candidate_id": str(candidate_id),
                "mode": "predefined",
                "paper_id": paper_a_id,
            }
            # POST /api/v1/task-papers/assign
            response = client.post(
                "/api/v1/task-papers/assign",
                json=assign_predefined_payload,
            )
            assert response.status_code == 200
            assigned_paper = response.json()
            assert assigned_paper["name"].startswith("Custom Paper - ")
            assert len(assigned_paper["questions"]) == 5
            assert assigned_paper["project_task"][0]["task"] == "Build a REST API with FastAPI."
            assert assigned_paper["project_task"][0]["instructions"] == "Build it using clean architecture and proper testing."
            assert assigned_paper["task_file_path"] is None

            # Test sending email after assigning predefined paper returns 200
            email_payload["paper_id"] = assigned_paper["id"]
            response = client.post(
                "/api/v1/task-papers/send-email",
                json=email_payload,
            )
            assert response.status_code == 200
            assert response.json()["status"] == "success"

            # Test sending email to non-existent candidate returns 404
            bad_email_payload = {
                "candidate_email": "nonexistent@example.com",
                "paper_id": assigned_paper["id"],
            }
            response = client.post(
                "/api/v1/task-papers/send-email",
                json=bad_email_payload,
            )
            assert response.status_code == 404

            # Verify non-existent candidate email returns 404
            bad_assign_payload = {
                "candidate_id": str(UUIDHelper.generate_uuid7()),
                "mode": "predefined",
                "paper_id": paper_a_id,
            }
            bad_response = client.post(
                "/api/v1/task-papers/assign",
                json=bad_assign_payload,
            )
            assert bad_response.status_code == 404

            # GET /api/v1/task-papers/assigned/{candidate_id}
            response = client.get(f"/api/v1/task-papers/assigned/{candidate_id}")
            assert response.status_code == 200
            assert response.json()["name"].startswith("Custom Paper - ")
            assert response.json()["task_file_path"] is None

            # 5b. Verify candidate task fallback download and get endpoints
            # GET /api/v1/task-papers/assigned/{candidate_id}/task/file
            response = client.get(f"/api/v1/task-papers/assigned/{candidate_id}/task/file")
            assert response.status_code == 200
            assert response.headers["content-type"] == "application/pdf"

            # GET /api/v1/task-papers/assigned/{candidate_id}/task
            response = client.get(f"/api/v1/task-papers/assigned/{candidate_id}/task")
            assert response.status_code == 200
            assert response.json()["task_file_path"] is None
            assert response.json()["is_custom_task"] is False

            # 5c. Verify candidate test paper assignment with custom overrides
            assign_override_payload = {
                "candidate_id": str(candidate_id),
                "mode": "predefined",
                "paper_id": paper_a_id,
                "questions": ["Override Q1", "Override Q2", "Override Q3", "Override Q4", "Override Q5"],
                "project_task": "Override Project Task Description",
            }
            response = client.post(
                "/api/v1/task-papers/assign",
                json=assign_override_payload,
            )
            assert response.status_code == 200
            override_assigned = response.json()
            assert override_assigned["name"].startswith("Custom Paper - ")
            assert [q["question"] for q in override_assigned["questions"]] == ["Override Q1", "Override Q2", "Override Q3", "Override Q4", "Override Q5"]
            assert override_assigned["project_task"][0]["task"] == "Override Project Task Description"
            assert override_assigned["task_file_path"] is None
            assert override_assigned["task_skills"] is None

            # 6. Assign random paper (generates 5 random questions and 1 random task)
            assign_random_payload = {
                "candidate_id": str(candidate_id),
                "mode": "random",
            }
            response = client.post(
                "/api/v1/task-papers/assign", json=assign_random_payload
            )
            assert response.status_code == 200
            random_assigned = response.json()
            assert random_assigned["name"] == f"Randomized Test Paper ({job_title})"
            assert len(random_assigned["questions"]) == 10
            # Questions should be subset of the 10 pooled questions
            pooled_questions = [
                "Explain python generators.",
                "What is GIL?",
                "How decorators work?",
                "Explain python list comprehension.",
                "Explain python type hints.",
                "What is asyncio?",
                "How does multithreading differ from multiprocessing in Python?",
                "What are metaclasses?",
                "How do you handle memory management in Python?",
                "Explain __slots__.",
            ]
            import re
            for q in random_assigned["questions"]:
                q_text = q["question"] if isinstance(q, dict) else q
                assert re.sub(r"^\[.*?\]\s*", "", q_text) in pooled_questions
            # Project task should be either from paper A or paper B
            clean_project_task = [re.sub(r"^\[.*?\]\s*", "", t["task"]) for t in random_assigned["project_task"]]
            assert clean_project_task in [
                ["Build a REST API with FastAPI."],
                ["Implement a task runner in Python."],
            ]

            # 7. Assign custom paper
            assign_custom_payload = {
                "candidate_id": str(candidate_id),
                "mode": "custom",
                "questions": ["Custom Q1", "Custom Q2", "Custom Q3", "Custom Q4", "Custom Q5"],
                "project_task": "Build a REST API with FastAPI.  \n\n---\n\n  Implement a task runner in Python.\n\n---\n\nTask:\nwhat is catgpt\n\nInstructions:\nuse chatgpt",
            }
            response = client.post(
                "/api/v1/task-papers/assign", json=assign_custom_payload
            )
            assert response.status_code == 200
            custom_assigned = response.json()
            assert custom_assigned["name"] == "Custom Test Paper"
            assert [q["question"] for q in custom_assigned["questions"]] == [
                "Custom Q1",
                "Custom Q2",
                "Custom Q3",
                "Custom Q4",
                "Custom Q5",
            ]
            assert len(custom_assigned["project_task"]) == 3
            assert custom_assigned["project_task"][0]["task"] == "Build a REST API with FastAPI."
            assert custom_assigned["project_task"][0]["instructions"] == "Build it using clean architecture and proper testing."
            assert custom_assigned["project_task"][1]["task"] == "Implement a task runner in Python."
            assert custom_assigned["project_task"][1]["instructions"] == "Build it using clean architecture and proper testing."
            assert custom_assigned["project_task"][2]["task"] == "what is catgpt"
            assert custom_assigned["project_task"][2]["instructions"] == "use chatgpt"

            # 8. Unassign/Delete candidate test paper
            # DELETE /api/v1/task-papers/assigned/{candidate_id}
            response = client.delete(f"/api/v1/task-papers/assigned/{candidate_id}")
            assert response.status_code == 204

            # GET candidate test paper should now return 404
            response = client.get(f"/api/v1/task-papers/assigned/{candidate_id}")
            assert response.status_code == 404

            # 8b. Assign paper to Job level (common default paper)
            assign_job_payload = {
                "job_id": str(job_id),
                "mode": "predefined",
                "paper_id": paper_b_id,
            }
            response = client.post(
                "/api/v1/task-papers/assign",
                json=assign_job_payload,
            )
            assert response.status_code == 200
            job_assigned = response.json()
            assert job_assigned["candidate_id"] is None
            assert job_assigned["job_id"] == str(job_id)

            # GET candidate's assigned paper should now fall back to the job-level default!
            response = client.get(f"/api/v1/task-papers/assigned/{candidate_id}")
            assert response.status_code == 200
            assert response.json()["name"].startswith("Custom Paper - ")
            assert response.json()["candidate_id"] is None

            # GET task download should also fall back to job-level paper
            response = client.get(f"/api/v1/task-papers/assigned/{candidate_id}/task/file")
            assert response.status_code == 200
            assert response.headers["content-type"] == "application/pdf"

            # Test sending email using job-level default paper returns 200
            email_payload = {
                "candidate_email": candidate_email,
                "paper_id": job_assigned["id"],
            }
            response = client.post(
                "/api/v1/task-papers/send-email",
                json=email_payload,
            )
            assert response.status_code == 200
            assert response.json()["status"] == "success"

            # Test sending email in bulk using candidate IDs
            bulk_payload_ids = {
                "candidate_ids": [str(candidate_id)],
                "paper_id": job_assigned["id"],
                "force": True,
            }
            response = client.post(
                "/api/v1/task-papers/send-email/bulk",
                json=bulk_payload_ids,
            )
            assert response.status_code == 200
            assert response.json()["status"] == "success"
            assert candidate_email in response.json()["sent_to"]

            # Test sending email in bulk using candidate emails
            bulk_payload_emails = {
                "candidate_emails": [candidate_email],
                "paper_id": job_assigned["id"],
                "force": True,
            }
            response = client.post(
                "/api/v1/task-papers/send-email/bulk",
                json=bulk_payload_emails,
            )
            assert response.status_code == 200
            assert response.json()["status"] == "success"
            assert candidate_email in response.json()["sent_to"]

            # Test GET /assigned/job/{job_id}
            response = client.get(f"/api/v1/task-papers/assigned/job/{job_id}")
            assert response.status_code == 200
            assert response.json()["name"].startswith("Custom Paper - ")

            # Test DELETE /assigned/job/{job_id}
            response = client.delete(f"/api/v1/task-papers/assigned/job/{job_id}")
            assert response.status_code == 204

            # Test GET /assigned/job/{job_id} after deletion returns 404
            response = client.get(f"/api/v1/task-papers/assigned/job/{job_id}")
            assert response.status_code == 404

            # DELETE /api/v1/task-papers/{paper_id}
            response = client.delete(f"/api/v1/task-papers/{paper_a_id}")
            assert response.status_code == 204

    finally:
        # Clean up overrides
        app.dependency_overrides.clear()

        # Clean up database records
        async with engine.begin() as conn:
            await conn.execute(
                text("DELETE FROM candidate_test_paper_histories WHERE candidate_id = :id"),
                {"id": candidate_id},
            )
            await conn.execute(
                text("DELETE FROM candidate_test_papers WHERE job_id = :id"),
                {"id": job_id},
            )
            await conn.execute(text("DELETE FROM candidate_stages WHERE id = :id"), {"id": candidate_stage_id})
            await conn.execute(text("DELETE FROM job_stage_configs WHERE id = :id"), {"id": job_stage_id})
            await conn.execute(text("DELETE FROM stage_templates WHERE id = :id"), {"id": template_id})
            await conn.execute(text("DELETE FROM candidates WHERE id = :id"), {"id": candidate_id})
            await conn.execute(
                text("DELETE FROM question_set_papers WHERE department_id = :id"), {"id": department_id}
            )
            await conn.execute(
                text("DELETE FROM job_skills WHERE job_id = :id"), {"id": job_id}
            )
            await conn.execute(text("DELETE FROM jobs WHERE id = :id"), {"id": job_id})
            for cid in created_skill_ids:
                await conn.execute(
                    text("DELETE FROM skills WHERE id = :id"), {"id": cid}
                )
            await conn.execute(
                text("DELETE FROM departments WHERE id = :id"), {"id": department_id}
            )
            await conn.execute(
                text("DELETE FROM job_positions WHERE id = :id"), {"id": position_id}
            )
            await conn.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
            await conn.execute(text("DELETE FROM roles WHERE id = :id"), {"id": role_id})

        # Clean up files from disk
        try:
            from app.v1.core.storage import resolve_storage_path
            from app.v1.core.config import settings
            tasks_dir = resolve_storage_path(settings.TASK_UPLOAD_DIR)
            for file_name in [f"paper_{paper_a_id}.pdf", f"paper_{paper_b_id}.docx"]:
                f_path = tasks_dir / file_name
                if f_path.is_file():
                    f_path.unlink()
        except Exception:
            pass


@pytest.mark.anyio
async def test_task_papers_mcq_flow():
    # 1. Setup mock records
    test_id_suffix = str(UUIDHelper.generate_uuid7())[:8]
    job_title = f"Test MCQ Engineer {test_id_suffix}"
    position_name = f"Test MCQ Level {test_id_suffix}"
    candidate_email = f"test_candidate_mcq_{test_id_suffix}@example.com"
    user_email = f"test_user_mcq_{test_id_suffix}@example.com"

    async with engine.begin() as conn:
        # Create role
        role_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO roles (id, name, created_at, updated_at) "
                "VALUES (:id, :name, NOW(), NOW())"
            ),
            {"id": role_id, "name": f"Test Role {test_id_suffix}"},
        )

        # Create user
        user_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO users (id, email, password_hash, role_id, is_active, created_at, updated_at) "
                "VALUES (:id, :email, 'hash', :role_id, true, NOW(), NOW())"
            ),
            {"id": user_id, "email": user_email, "role_id": role_id},
        )

        # Create department
        department_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO departments (id, name, description) "
                "VALUES (:id, :name, 'Test Department')"
            ),
            {"id": department_id, "name": f"Test Department {test_id_suffix}"},
        )

        # Select or insert Python skill
        res_skill = await conn.execute(
            text("SELECT id FROM skills WHERE name = 'Python'")
        )
        row = res_skill.fetchone()
        created_skill_ids = []
        if row:
            skill_id = row[0]
        else:
            skill_id = UUIDHelper.generate_uuid7()
            await conn.execute(
                text("INSERT INTO skills (id, name, description) VALUES (:id, 'Python', 'Test Skill Description')"),
                {"id": skill_id}
            )
            created_skill_ids.append(skill_id)

        # Create position level
        position_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO job_positions (id, name, created_at, updated_at) "
                "VALUES (:id, :name, NOW(), NOW())"
            ),
            {"id": position_id, "name": position_name},
        )

        # Create job linked to position level and department
        job_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO jobs (id, title, department_id, position_id, is_active, passing_threshold, version, created_at) "
                "VALUES (:id, :title, :department_id, :position_id, true, 70.0, 1, NOW())"
            ),
            {"id": job_id, "title": job_title, "department_id": department_id, "position_id": position_id},
        )

        # Link job to skill
        await conn.execute(
            text(
                "INSERT INTO job_skills (job_id, skill_id) "
                "VALUES (:job_id, :skill_id)"
            ),
            {"job_id": job_id, "skill_id": skill_id},
        )

        # Create candidate linked to job
        candidate_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO candidates (id, first_name, last_name, email, applied_job_id, created_at) "
                "VALUES (:id, 'Jane', 'Doe', :email, :job_id, NOW())"
            ),
            {"id": candidate_id, "email": candidate_email, "job_id": job_id},
        )

        # Create Stage Template for Technical Practical Round
        template_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO stage_templates (id, name, description, default_config, created_at) "
                "VALUES (:id, 'Technical Practical Round', 'Practical', '{}', NOW())"
            ),
            {"id": template_id},
        )

        # Create JobStageConfig
        job_stage_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO job_stage_configs (id, job_id, template_id, stage_order, is_default, config, is_mandatory, created_at) "
                "VALUES (:id, :job_id, :template_id, 1, false, '{}', true, NOW())"
            ),
            {"id": job_stage_id, "job_id": job_id, "template_id": template_id},
        )

        # Create CandidateStage
        candidate_stage_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO candidate_stages (id, candidate_id, job_stage_id, status, started_at) "
                "VALUES (:id, :candidate_id, :job_stage_id, 'active', NOW())"
            ),
            {"id": candidate_stage_id, "candidate_id": candidate_id, "job_stage_id": job_stage_id},
        )

    # 2. Mock authentication
    mock_user = UserRead(
        id=user_id,
        email=user_email,
        is_active=True,
        is_superuser=True,
        first_name="Test",
        last_name="MCQ",
        role_id=role_id,
        role_name=f"Test Role {test_id_suffix}",
        permissions=["candidates:decide", "candidates:access", "questions:upload", "questions:manage", "admin:all"],
    )
    app.dependency_overrides[get_current_user] = lambda: mock_user
    client = TestClient(app)

    try:
        with patch("app.v1.routes.task_papers_email.send_candidate_task_email_via_smtp") as _:
            # 3. Create predefined MCQ paper via POST /manual
            data = {
                "department_id": str(department_id),
                "position_id": str(position_id),
                "skill_ids": [str(skill_id)],
                "paper_type": "mcq",
                "questions": [],
                "mcqs": [
                    {
                        "question": "What is Python?",
                        "options": ["A programming language", "A snake", "An IDE", "None"],
                        "answer": "A programming language"
                    }
                ],
                "project_task": []
            }
            response = client.post("/api/v1/task-papers/manual", json=data)
            assert response.status_code == 201
            paper = response.json()
            paper_id = paper["id"]
            assert paper["paper_type"] == "mcq"

            # Check that paper is updated in DB
            response = client.get(f"/api/v1/task-papers/{paper_id}")
            assert response.status_code == 200
            assert response.json()["paper_type"] == "mcq"
            assert len(response.json()["mcqs"]) == 1
            assert response.json()["mcqs"][0]["question"] == "What is Python?"

            # 5. List with filtering by paper_type
            response = client.get(f"/api/v1/task-papers?paper_type=mcq")
            assert response.status_code == 200
            assert len(response.json()["data"]) >= 1
            assert response.json()["data"][0]["paper_type"] == "mcq"

            # 5b. Verify all-content endpoint aggregates MCQs
            response = client.get(f"/api/v1/task-papers/all-content")
            assert response.status_code == 200
            all_content = response.json()
            assert len(all_content) == 3
            mcq_questions = [m["question"] for m in all_content["mcqs"]]
            assert "What is Python?" in mcq_questions
            assert "answer" not in all_content["mcqs"][0]

            # 6. Assign predefined MCQ paper to candidate
            assign_payload = {
                "candidate_id": str(candidate_id),
                "mode": "predefined",
                "paper_id": paper_id
            }
            response = client.post("/api/v1/task-papers/assign", json=assign_payload)
            assert response.status_code == 200
            assigned = response.json()
            assert len(assigned["mcqs"]) == 1
            assert assigned["mcqs"][0]["question"] == "What is Python?"

            # Check assigned task download (should render MCQs in PDF)
            response = client.get(f"/api/v1/task-papers/assigned/{candidate_id}/task/file")
            assert response.status_code == 200
            assert response.headers["content-type"] == "application/pdf"

            # 7. Assign custom paper with custom MCQs
            assign_custom = {
                "candidate_id": str(candidate_id),
                "mode": "custom",
                "mcqs": [
                    {
                        "question": "What is FastAPI?",
                        "options": ["A framework", "A database", "A server", "None"],
                        "answer": "A framework"
                    }
                ]
            }
            response = client.post("/api/v1/task-papers/assign", json=assign_custom)
            assert response.status_code == 200
            custom_assigned = response.json()
            assert len(custom_assigned["mcqs"]) == 1
            assert custom_assigned["mcqs"][0]["question"] == "What is FastAPI?"

    finally:
        app.dependency_overrides.clear()
        async with engine.begin() as conn:
            await conn.execute(text("DELETE FROM candidate_test_paper_histories WHERE candidate_id = :id"), {"id": candidate_id})
            await conn.execute(text("DELETE FROM candidate_test_papers WHERE job_id = :id"), {"id": job_id})
            await conn.execute(text("DELETE FROM candidate_stages WHERE id = :id"), {"id": candidate_stage_id})
            await conn.execute(text("DELETE FROM job_stage_configs WHERE id = :id"), {"id": job_stage_id})
            await conn.execute(text("DELETE FROM stage_templates WHERE id = :id"), {"id": template_id})
            await conn.execute(text("DELETE FROM candidates WHERE id = :id"), {"id": candidate_id})
            await conn.execute(text("DELETE FROM question_set_papers WHERE department_id = :id"), {"id": department_id})
            await conn.execute(text("DELETE FROM job_skills WHERE job_id = :id"), {"id": job_id})
            await conn.execute(text("DELETE FROM jobs WHERE id = :id"), {"id": job_id})
            for cid in created_skill_ids:
                await conn.execute(text("DELETE FROM skills WHERE id = :id"), {"id": cid})
            await conn.execute(text("DELETE FROM departments WHERE id = :id"), {"id": department_id})
            await conn.execute(text("DELETE FROM job_positions WHERE id = :id"), {"id": position_id})
            await conn.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
            await conn.execute(text("DELETE FROM roles WHERE id = :id"), {"id": role_id})

        try:
            from app.v1.core.storage import resolve_storage_path
            from app.v1.core.config import settings
            tasks_dir = resolve_storage_path(settings.TASK_UPLOAD_DIR)
            f_path = tasks_dir / f"paper_{paper_id}.pdf"
            if f_path.is_file():
                f_path.unlink()
        except Exception:
            pass


@pytest.mark.anyio
async def test_task_papers_duplicate_checks():
    # 1. Setup mock records
    test_id_suffix = str(UUIDHelper.generate_uuid7())[:8]
    position_name = f"Test Duplicate Level {test_id_suffix}"
    user_email = f"test_dup_user_{test_id_suffix}@example.com"
    pos_senior_id = None

    async with engine.begin() as conn:
        # Create role
        role_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO roles (id, name, created_at, updated_at) "
                "VALUES (:id, :name, NOW(), NOW())"
            ),
            {"id": role_id, "name": f"Test Role {test_id_suffix}"},
        )

        # Create user
        user_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO users (id, email, password_hash, role_id, is_active, created_at, updated_at) "
                "VALUES (:id, :email, 'hash', :role_id, true, NOW(), NOW())"
            ),
            {"id": user_id, "email": user_email, "role_id": role_id},
        )

        # Create department
        department_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO departments (id, name, description) "
                "VALUES (:id, :name, 'Test Department')"
            ),
            {"id": department_id, "name": f"Test Department {test_id_suffix}"},
        )

        # Ensure Python and FastAPI skills exist
        skills_to_check = ["Python", "FastAPI"]
        job_skill_ids = []
        created_skill_ids = []
        for s_name in skills_to_check:
            res_skill = await conn.execute(
                text("SELECT id FROM skills WHERE name = :name"),
                {"name": s_name}
            )
            row = res_skill.fetchone()
            if row:
                s_id = row[0]
            else:
                s_id = UUIDHelper.generate_uuid7()
                await conn.execute(
                    text("INSERT INTO skills (id, name, description) VALUES (:id, :name, 'Test Skill')"),
                    {"id": s_id, "name": s_name}
                )
                created_skill_ids.append(s_id)
            job_skill_ids.append(s_id)

        python_skill_id, fastapi_skill_id = job_skill_ids[0], job_skill_ids[1]

        # Create position level
        position_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO job_positions (id, name, created_at, updated_at) "
                "VALUES (:id, :name, NOW(), NOW())"
            ),
            {"id": position_id, "name": position_name},
        )

    # 2. Mock authentication
    mock_user = UserRead(
        id=user_id,
        email=user_email,
        is_active=True,
        is_superuser=True,
        first_name="Test",
        last_name="Dup",
        role_id=role_id,
        role_name=f"Test Role {test_id_suffix}",
        permissions=["candidates:decide", "candidates:access", "questions:manage", "admin:all"],
    )
    app.dependency_overrides[get_current_user] = lambda: mock_user
    client = TestClient(app)

    paper_1_id = None
    paper_2_id = None
    try:
        # A. Create Paper 1: Python skill, with question "what is python"
        data_1 = {
            "department_id": str(department_id),
            "position_id": str(position_id),
            "skill_ids": [str(python_skill_id)],
            "paper_type": "mixed",
            "questions": ["what is python"],
            "mcqs": [
                {
                    "question": "What is Python MCQ?",
                    "options": ["A", "B", "C"],
                    "answer": "A"
                }
            ],
            "project_task": [{"task": "Implement Python task", "instructions": "Implement the task with proper tests."}]
        }
        res = client.post("/api/v1/task-papers/manual", json=data_1)
        assert res.status_code == 201
        paper_1 = res.json()
        paper_1_id = paper_1["id"]
        assert len(paper_1["skills"]) == 1
        assert paper_1["skills"][0]["name"] == "Python"

        # B. Test local duplicate check inside payload
        data_local_dup = {
            "department_id": str(department_id),
            "position_id": str(position_id),
            "skill_ids": [str(fastapi_skill_id)],
            "paper_type": "mixed",
            "questions": ["q1", "q1"],
            "mcqs": [],
            "project_task": []
        }
        res = client.post("/api/v1/task-papers/manual", json=data_local_dup)
        assert res.status_code == 400
        assert "Duplicate questions" in res.json()["detail"]

        # C. Test system duplicate question check (different skill, same dept + position)
        data_2 = {
            "department_id": str(department_id),
            "position_id": str(position_id),
            "skill_ids": [str(fastapi_skill_id)],
            "paper_type": "mixed",
            "questions": ["what is python"],
            "mcqs": [],
            "project_task": []
        }
        res = client.post("/api/v1/task-papers/manual", json=data_2)
        assert res.status_code == 400
        assert "This question already exists in the system." in res.json()["detail"]

        # Verify that Paper 1's skills now include both Python AND FastAPI!
        res_p1 = client.get(f"/api/v1/task-papers/{paper_1_id}")
        assert res_p1.status_code == 200
        p1_skills = [s["name"] for s in res_p1.json()["skills"]]
        assert "Python" in p1_skills
        assert "FastAPI" in p1_skills

        # D. Test system duplicate MCQ check
        data_mcq_dup = {
            "department_id": str(department_id),
            "position_id": str(position_id),
            "skill_ids": [str(fastapi_skill_id)],
            "paper_type": "mixed",
            "questions": [],
            "mcqs": [
                {
                    "question": "What is Python MCQ?",
                    "options": ["A", "B", "C"],
                    "answer": "A"
                }
            ],
            "project_task": []
        }
        res = client.post("/api/v1/task-papers/manual", json=data_mcq_dup)
        assert res.status_code == 400
        assert "This MCQ already exists in the system." in res.json()["detail"]

        # E. Test system duplicate Task check
        data_task_dup = {
            "department_id": str(department_id),
            "position_id": str(position_id),
            "skill_ids": [str(fastapi_skill_id)],
            "paper_type": "mixed",
            "questions": [],
            "mcqs": [],
            "project_task": [{"task": "Implement Python task", "instructions": "Implement the task with proper tests."}]
        }
        res = client.post("/api/v1/task-papers/manual", json=data_task_dup)
        assert res.status_code == 400
        assert "This task already exists in the system." in res.json()["detail"]

        # F. Create a new independent paper with different position (should allow same question)
        # Create a new position
        async with engine.begin() as conn:
            pos_senior_id = UUIDHelper.generate_uuid7()
            await conn.execute(
                text(
                    "INSERT INTO job_positions (id, name, created_at, updated_at) "
                    "VALUES (:id, 'Senior Dev', NOW(), NOW())"
                ),
                {"id": pos_senior_id},
            )

        data_senior = {
            "department_id": str(department_id),
            "position_id": str(pos_senior_id),
            "skill_ids": [str(python_skill_id)],
            "paper_type": "mixed",
            "questions": ["what is python"],
            "mcqs": [],
            "project_task": []
        }
        res = client.post("/api/v1/task-papers/manual", json=data_senior)
        assert res.status_code == 201
        paper_2_id = res.json()["id"]

    finally:
        app.dependency_overrides.clear()
        async with engine.begin() as conn:
            await conn.execute(
                text("DELETE FROM question_set_papers WHERE department_id = :id"), {"id": department_id}
            )
            for cid in created_skill_ids:
                await conn.execute(
                    text("DELETE FROM skills WHERE id = :id"), {"id": cid}
                )
            await conn.execute(
                text("DELETE FROM departments WHERE id = :id"), {"id": department_id}
            )
            await conn.execute(
                text("DELETE FROM job_positions WHERE name = :name OR id = :pos_id"),
                {
                    "name": position_name,
                    "pos_id": pos_senior_id if pos_senior_id else UUIDHelper.generate_uuid7()
                }
            )
            await conn.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
            await conn.execute(text("DELETE FROM roles WHERE id = :id"), {"id": role_id})



@pytest.mark.anyio
async def test_dynamic_stage_requirements():
    test_id_suffix = str(UUIDHelper.generate_uuid7())[:8]
    job_title = f"Test Job {test_id_suffix}"
    position_name = f"Test Pos {test_id_suffix}"
    candidate_email = f"candidate_{test_id_suffix}@example.com"
    user_email = f"user_{test_id_suffix}@example.com"

    async with engine.begin() as conn:
        role_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text("INSERT INTO roles (id, name, created_at, updated_at) VALUES (:id, :name, NOW(), NOW())"),
            {"id": role_id, "name": f"Role {test_id_suffix}"},
        )
        user_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text("INSERT INTO users (id, email, password_hash, role_id, is_active, created_at, updated_at) VALUES (:id, :email, 'hash', :role_id, true, NOW(), NOW())"),
            {"id": user_id, "email": user_email, "role_id": role_id},
        )
        department_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text("INSERT INTO departments (id, name, description) VALUES (:id, :name, 'Dept')"),
            {"id": department_id, "name": f"Dept {test_id_suffix}"},
        )
        position_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text("INSERT INTO job_positions (id, name, created_at, updated_at) VALUES (:id, :name, NOW(), NOW())"),
            {"id": position_id, "name": position_name},
        )
        
        # Create a skill
        skill_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text("INSERT INTO skills (id, name, description) VALUES (:id, :name, 'Description')"),
            {"id": skill_id, "name": f"Skill {test_id_suffix}"},
        )

        job_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text("INSERT INTO jobs (id, title, department_id, position_id, is_active, passing_threshold, version, created_at) VALUES (:id, :title, :department_id, :position_id, true, 70.0, 1, NOW())"),
            {"id": job_id, "title": job_title, "department_id": department_id, "position_id": position_id},
        )
        candidate_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text("INSERT INTO candidates (id, first_name, last_name, email, applied_job_id, created_at) VALUES (:id, 'John', 'Doe', :email, :job_id, NOW())"),
            {"id": candidate_id, "email": candidate_email, "job_id": job_id},
        )
        # Stage Template A (Requires: github, question)
        template_a_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text("INSERT INTO stage_templates (id, name, description, default_config, created_at) VALUES (:id, 'Stage A', 'A', '{\"required_inputs\": [\"github\", \"question\"]}', NOW())"),
            {"id": template_a_id},
        )
        job_stage_a_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text("INSERT INTO job_stage_configs (id, job_id, template_id, stage_order, is_default, config, is_mandatory, created_at) VALUES (:id, :job_id, :template_id, 1, false, '{\"required_inputs\": [\"github\", \"question\"]}', true, NOW())"),
            {"id": job_stage_a_id, "job_id": job_id, "template_id": template_a_id},
        )
        candidate_stage_a_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text("INSERT INTO candidate_stages (id, candidate_id, job_stage_id, status, started_at) VALUES (:id, :candidate_id, :job_stage_id, 'active', NOW())"),
            {"id": candidate_stage_a_id, "candidate_id": candidate_id, "job_stage_id": job_stage_a_id},
        )

    mock_user = UserRead(
        id=user_id,
        email=user_email,
        is_active=True,
        is_superuser=True,
        first_name="Test",
        last_name="User",
        role_id=role_id,
        role_name=f"Role {test_id_suffix}",
        permissions=["candidates:decide", "candidates:access", "admin:all"],
    )
    app.dependency_overrides[get_current_user] = lambda: mock_user
    client = TestClient(app)

    try:
        # Create a paper first
        data_paper = {
            "department_id": str(department_id),
            "position_id": str(position_id),
            "skill_ids": [str(skill_id)],
            "paper_type": "mixed",
            "questions": ["Q1"],
            "mcqs": [],
            "project_task": [{"task": "Build a task runner project in Python.", "instructions": "Implement the task with proper tests."}]
        }
        res_paper = client.post("/api/v1/task-papers/manual", json=data_paper)
        assert res_paper.status_code == 201
        paper_id = res_paper.json()["id"]

        # Test 1: Assign predefined paper to Candidate (should succeed because active stage A requires "question")
        assign_payload = {
            "candidate_id": str(candidate_id),
            "mode": "predefined",
            "paper_id": paper_id,
        }
        res_assign = client.post("/api/v1/task-papers/assign", json=assign_payload)
        assert res_assign.status_code == 200

        # Test 2: Upload transcript to CandidateStage A (should fail because Stage A doesn't require "transcript")
        files = {"files": ("test.txt", b"Hello speaker 1: test")}
        res_upload = client.post(f"/api/v1/transcripts/upload-path/{candidate_stage_a_id}", files=files)
        assert res_upload.status_code == 400
        assert "not configured for Transcript upload" in res_upload.json()["detail"]

        # Test 3: Delete CandidateStage A, and add CandidateStage B (Requires: transcript)
        async with engine.begin() as conn:
            await conn.execute(text("DELETE FROM candidate_stages WHERE id = :id"), {"id": candidate_stage_a_id})
            await conn.execute(text("DELETE FROM candidate_test_papers WHERE candidate_id = :id"), {"id": candidate_id})
            
            template_b_id = UUIDHelper.generate_uuid7()
            await conn.execute(
                text("INSERT INTO stage_templates (id, name, description, default_config, created_at) VALUES (:id, 'Stage B', 'B', '{\"required_inputs\": [\"transcript\"]}', NOW())"),
                {"id": template_b_id},
            )
            job_stage_b_id = UUIDHelper.generate_uuid7()
            await conn.execute(
                text("INSERT INTO job_stage_configs (id, job_id, template_id, stage_order, is_default, config, is_mandatory, created_at) VALUES (:id, :job_id, :template_id, 1, false, '{\"required_inputs\": [\"transcript\"]}', true, NOW())"),
                {"id": job_stage_b_id, "job_id": job_id, "template_id": template_b_id},
            )
            candidate_stage_b_id = UUIDHelper.generate_uuid7()
            await conn.execute(
                text("INSERT INTO candidate_stages (id, candidate_id, job_stage_id, status, started_at) VALUES (:id, :candidate_id, :job_stage_id, 'active', NOW())"),
                {"id": candidate_stage_b_id, "candidate_id": candidate_id, "job_stage_id": job_stage_b_id},
            )

        # Test 4: Get assigned paper (should fail now because active stage B does not require "question")
        res_get_b = client.get(f"/api/v1/task-papers/assigned/{candidate_id}")
        assert res_get_b.status_code == 404
        assert "Candidate has not reached the test paper stage yet." in res_get_b.json()["detail"]

        # Test 5: Upload transcript to CandidateStage B (should succeed/start processing because Stage B requires "transcript")
        with patch("app.v1.services.transcript_tasks.process_transcript_task.delay") as mock_celery:
            res_upload_b = client.post(f"/api/v1/transcripts/upload-path/{candidate_stage_b_id}", files=files)
            assert res_upload_b.status_code == 200
            assert "Processing started" in res_upload_b.json()["message"]
            mock_celery.assert_called_once()

    finally:
        app.dependency_overrides.clear()
        async with engine.begin() as conn:
            await conn.execute(text("DELETE FROM candidate_stages WHERE candidate_id = :id"), {"id": candidate_id})
            await conn.execute(text("DELETE FROM job_stage_configs WHERE job_id = :id"), {"id": job_id})
            await conn.execute(text("DELETE FROM stage_templates WHERE id IN (:id_a, :id_b)"), {"id_a": template_a_id, "id_b": template_b_id if 'template_b_id' in locals() else template_a_id})
            await conn.execute(text("DELETE FROM candidates WHERE id = :id"), {"id": candidate_id})
            await conn.execute(text("DELETE FROM jobs WHERE id = :id"), {"id": job_id})
            await conn.execute(text("DELETE FROM job_positions WHERE id = :id"), {"id": position_id})
            await conn.execute(text("DELETE FROM departments WHERE id = :id"), {"id": department_id})
            await conn.execute(text("DELETE FROM skills WHERE id = :id"), {"id": skill_id})
            await conn.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
            await conn.execute(text("DELETE FROM roles WHERE id = :id"), {"id": role_id})


if __name__ == "__main__":
    import asyncio

    asyncio.run(test_task_papers_flow())


