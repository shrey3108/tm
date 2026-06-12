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

        # Create position level
        position_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO job_positions (id, name, created_at, updated_at) "
                "VALUES (:id, :name, NOW(), NOW())"
            ),
            {"id": position_id, "name": position_name},
        )

        # Create job linked to position level
        job_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO jobs (id, title, position_id, is_active, passing_threshold, version, created_at) "
                "VALUES (:id, :title, :position_id, true, 70.0, 1, NOW())"
            ),
            {"id": job_id, "title": job_title, "position_id": position_id},
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
        # Patch Celery task trigger and Document parsing & LLM extraction helpers to test logic synchronously
        with patch("app.v1.services.admin.job_tasks.extract_paper_task_skills_task.delay") as mock_delay, \
             patch("app.v1.core.extractor.DocumentParser.extract_text") as mock_extract_text, \
             patch("app.v1.core.extractor.DocumentParser.extract_text_docling") as mock_extract_text_docling, \
             patch("app.v1.services.admin.candidate_task_service.candidate_task_service.extract_paper_details_from_text") as mock_llm_extract, \
             patch("app.v1.routes.task_papers_email.send_candidate_task_email_via_smtp") as mock_send_email:

            # 3. Create question set papers via Form Upload
            # Upload Paper A
            files_a = {"task_file": ("test_task_a.pdf", b"test pdf content a", "application/pdf")}
            data = {"job_id": str(job_id), "position_id": str(position_id)}
            response = client.post("/api/v1/task-papers/upload", data=data, files=files_a)
            assert response.status_code == 201
            created_papers_a = response.json()
            assert len(created_papers_a) == 1
            paper_a = created_papers_a[0]
            paper_a_id = paper_a["id"]
            assert paper_a["name"] == "test_task_a.pdf"
            assert paper_a["questions"] == []
            assert paper_a["project_task"] == ""

            # Upload Paper B
            files_b = {"task_file": ("test_task_b.docx", b"test docx content b", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
            response = client.post("/api/v1/task-papers/upload", data=data, files=files_b)
            assert response.status_code == 201
            created_papers_b = response.json()
            assert len(created_papers_b) == 1
            paper_b = created_papers_b[0]
            paper_b_id = paper_b["id"]
            assert paper_b["name"] == "test_task_b.docx"
            assert paper_b["questions"] == []
            assert paper_b["project_task"] == ""

            # Verify that background task was queued twice
            assert mock_delay.call_count == 2

            # Simulate Celery background execution synchronously
            from app.v1.services.admin.job_tasks import extract_paper_task_skills_logic
            
            mock_extract_text.return_value = "dummy text content for paper A"
            mock_extract_text_docling.return_value = "dummy text content for paper A"
            mock_llm_extract.return_value = {
                "questions": [
                    "Explain python generators.",
                    "What is GIL?",
                    "How decorators work?",
                    "Explain python list comprehension.",
                    "Explain python type hints.",
                ],
                "project_task": "Build a REST API with FastAPI.",
                "skills": ["FastAPI", "Python"],
            }
            await extract_paper_task_skills_logic(str(paper_a_id), paper_a["task_file_path"])

            mock_extract_text.return_value = "dummy text content for paper B"
            mock_extract_text_docling.return_value = "dummy text content for paper B"
            mock_llm_extract.return_value = {
                "questions": [
                    "What is asyncio?",
                    "How does multithreading differ from multiprocessing in Python?",
                    "What are metaclasses?",
                    "How do you handle memory management in Python?",
                    "Explain __slots__.",
                ],
                "project_task": "Implement a task runner in Python.",
                "skills": ["Asyncio", "Python"],
            }
            await extract_paper_task_skills_logic(str(paper_b_id), paper_b["task_file_path"])

            # 4. List question set papers
            # GET /api/v1/task-papers
            response = client.get("/api/v1/task-papers")
            assert response.status_code == 200
            # Ensure our created papers are in the returned list
            matching_papers = [p for p in response.json() if p["job_id"] == str(job_id)]
            assert len(matching_papers) == 2

            # GET /api/v1/task-papers?job_id=...
            response = client.get(f"/api/v1/task-papers?job_id={job_id}")
            assert response.status_code == 200
            assert len(response.json()) == 2

            # GET /api/v1/task-papers/{paper_id}
            response = client.get(f"/api/v1/task-papers/{paper_a_id}")
            assert response.status_code == 200
            assert response.json()["name"] == "test_task_a.pdf"

            # Verify Paper Task File download
            response = client.get(f"/api/v1/task-papers/{paper_a_id}/task-file")
            assert response.status_code == 200
            assert response.content == b"test pdf content a"

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
            assert assigned_paper["name"] == "test_task_a.pdf"
            assert len(assigned_paper["questions"]) == 5
            assert assigned_paper["project_task"] == "Build a REST API with FastAPI."
            assert assigned_paper["task_file_path"] is not None

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
            assert response.json()["name"] == "test_task_a.pdf"
            assert response.json()["task_file_path"] is not None

            # 5b. Verify candidate task fallback download and get endpoints
            # GET /api/v1/task-papers/assigned/{candidate_id}/task/file
            response = client.get(f"/api/v1/task-papers/assigned/{candidate_id}/task/file")
            assert response.status_code == 200
            assert response.content == b"test pdf content a"

            # GET /api/v1/task-papers/assigned/{candidate_id}/task
            response = client.get(f"/api/v1/task-papers/assigned/{candidate_id}/task")
            assert response.status_code == 200
            assert response.json()["task_file_path"] is not None
            assert response.json()["is_custom_task"] is True

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
            assert override_assigned["name"] == "test_task_a.pdf"
            assert override_assigned["questions"] == ["Override Q1", "Override Q2", "Override Q3", "Override Q4", "Override Q5"]
            assert override_assigned["project_task"] == "Override Project Task Description"
            assert override_assigned["task_file_path"] == paper_a["task_file_path"]
            assert override_assigned["task_skills"] == ["FastAPI", "Python"]

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
            assert len(random_assigned["questions"]) == 5
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
            for q in random_assigned["questions"]:
                assert q in pooled_questions
            # Project task should be either from paper A or paper B
            assert random_assigned["project_task"] in [
                "Build a REST API with FastAPI.",
                "Implement a task runner in Python.",
            ]

            # 7. Assign custom paper
            assign_custom_payload = {
                "candidate_id": str(candidate_id),
                "mode": "custom",
                "questions": ["Custom Q1", "Custom Q2", "Custom Q3", "Custom Q4", "Custom Q5"],
                "project_task": "Custom Project Task",
            }
            response = client.post(
                "/api/v1/task-papers/assign", json=assign_custom_payload
            )
            assert response.status_code == 200
            custom_assigned = response.json()
            assert custom_assigned["name"] == "Custom Test Paper"
            assert custom_assigned["questions"] == [
                "Custom Q1",
                "Custom Q2",
                "Custom Q3",
                "Custom Q4",
                "Custom Q5",
            ]
            assert custom_assigned["project_task"] == "Custom Project Task"

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
            assert response.json()["name"] == "test_task_b.docx"
            assert response.json()["candidate_id"] is None

            # GET task download should also fall back to job-level paper
            response = client.get(f"/api/v1/task-papers/assigned/{candidate_id}/task/file")
            assert response.status_code == 200
            assert response.content == b"test docx content b"

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
            assert response.json()["name"] == "test_task_b.docx"

            # Test DELETE /assigned/job/{job_id}
            response = client.delete(f"/api/v1/task-papers/assigned/job/{job_id}")
            assert response.status_code == 204

            # Test GET /assigned/job/{job_id} after deletion returns 404
            response = client.get(f"/api/v1/task-papers/assigned/job/{job_id}")
            assert response.status_code == 404

            # 9. Delete predefined QuestionSetPaper
            # DELETE /api/v1/task-papers/{paper_id}
            response = client.delete(f"/api/v1/task-papers/{paper_a_id}")
            assert response.status_code == 204

    finally:
        # Clean up overrides
        app.dependency_overrides.clear()

        # Clean up database records
        async with engine.begin() as conn:
            await conn.execute(
                text("DELETE FROM candidate_test_papers WHERE job_id = :id"),
                {"id": job_id},
            )
            await conn.execute(text("DELETE FROM candidate_stages WHERE id = :id"), {"id": candidate_stage_id})
            await conn.execute(text("DELETE FROM job_stage_configs WHERE id = :id"), {"id": job_stage_id})
            await conn.execute(text("DELETE FROM stage_templates WHERE id = :id"), {"id": template_id})
            await conn.execute(text("DELETE FROM candidates WHERE id = :id"), {"id": candidate_id})
            await conn.execute(
                text("DELETE FROM question_set_papers WHERE job_id = :id"), {"id": job_id}
            )
            await conn.execute(text("DELETE FROM jobs WHERE id = :id"), {"id": job_id})
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


if __name__ == "__main__":
    import asyncio

    asyncio.run(test_task_papers_flow())
