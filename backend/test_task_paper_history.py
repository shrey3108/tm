import pytest
import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import text, select
from app.main import app
from app.v1.db.session import engine
from app.v1.db.models.candidate_test_paper import CandidateTestPaper
from app.v1.db.models.candidate_test_paper_history import CandidateTestPaperHistory
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.schemas.user import UserRead
from app.v1.dependencies.auth import get_current_user
from app.v1.utils.uuid import UUIDHelper


@pytest.mark.anyio
async def test_task_paper_history_and_evaluation_flow():
    # 1. Setup mock records
    test_id_suffix = str(UUIDHelper.generate_uuid7())[:8]
    job_title = f"Test Job {test_id_suffix}"
    position_name = f"Test Pos {test_id_suffix}"
    candidate_email = f"c_{test_id_suffix}@example.com"
    user_email = f"u_{test_id_suffix}@example.com"

    async with engine.begin() as conn:
        # Create role
        role_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text("INSERT INTO roles (id, name, created_at, updated_at) VALUES (:id, :name, NOW(), NOW())"),
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
            text("INSERT INTO job_positions (id, name, created_at, updated_at) VALUES (:id, :name, NOW(), NOW())"),
            {"id": position_id, "name": position_name},
        )

        # Create job
        job_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO jobs (id, title, position_id, is_active, passing_threshold, version, created_at) "
                "VALUES (:id, :title, :position_id, true, 70.0, 1, NOW())"
            ),
            {"id": job_id, "title": job_title, "position_id": position_id},
        )

        # Create candidate
        candidate_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text(
                "INSERT INTO candidates (id, first_name, last_name, email, applied_job_id, created_at) "
                "VALUES (:id, 'Test', 'Candidate', :email, :job_id, NOW())"
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


    # Mock authentication
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
            # 2. Assign default job-level test paper
            assign_job_payload = {
                "job_id": str(job_id),
                "mode": "custom",
                "questions": ["Q1", "Q2", "Q3", "Q4", "Q5"],
                "mcqs": [{"question": "What is Python?", "options": ["lang", "snake"], "answer": "lang"}],
                "project_task": "Task A",
            }
            # Set job-level default paper
            response = client.post("/api/v1/task-papers/assign", json=assign_job_payload)
            assert response.status_code == 200
            job_paper_id = response.json()["id"]

            # Query candidate's assigned paper -> should fallback to the job default paper
            response = client.get(f"/api/v1/task-papers/assigned/{candidate_id}")
            assert response.status_code == 200
            res_json = response.json()
            assert res_json["id"] == job_paper_id
            assert res_json["name"] == "Custom Test Paper"
            assert res_json["project_task"] == [{"task": "Task A", "instructions": ""}]
            assert len(res_json["mcqs"]) == 1
            assert res_json["mcqs"][0]["question"] == "What is Python?"
            # It should not show that job default changed yet, because candidate does not have candidate-specific paper
            assert res_json["job_default_paper_changed"] is False

            # 3. Email default paper to candidate -> this should lock/clone it as candidate-specific
            email_payload = {
                "candidate_email": candidate_email,
                "paper_id": job_paper_id,
            }
            response = client.post("/api/v1/task-papers/send-email", json=email_payload)
            assert response.status_code == 200
            assert response.json()["status"] == "success"

            # Check CandidateTestPaper directly in database: candidate should now have a candidate-specific assignment!
            async with engine.connect() as conn:
                res_ctp = await conn.execute(
                    select(CandidateTestPaper).where(CandidateTestPaper.candidate_id == candidate_id)
                )
                cand_paper = res_ctp.mappings().first()
                assert cand_paper is not None
                assert cand_paper["name"] == "Custom Test Paper"
                assert cand_paper["project_task"] == [{"task": "Task A", "instructions": ""}]
                assert cand_paper["mcqs"] == [{"question": "What is Python?", "options": ["lang", "snake"], "answer": "lang"}]
                candidate_paper_id = cand_paper["id"]

            # Query assigned paper again -> should return candidate-specific assignment
            response = client.get(f"/api/v1/task-papers/assigned/{candidate_id}")
            assert response.status_code == 200
            res_json = response.json()
            assert res_json["id"] == str(candidate_paper_id)
            assert res_json["job_default_paper_changed"] is False
            assert len(res_json["mcqs"]) == 1
            assert res_json["mcqs"][0]["question"] == "What is Python?"

            # Check history log -> should contain 1 log entry
            response = client.get(f"/api/v1/task-papers/assigned/{candidate_id}/history")
            assert response.status_code == 200
            history = response.json()
            assert len(history) == 1
            assert history[0]["project_task"] == [{"task": "Task A", "instructions": ""}]
            assert len(history[0]["mcqs"]) == 1
            assert history[0]["mcqs"][0]["question"] == "What is Python?"

            # 4. Change job default paper to Paper B
            assign_job_payload_b = {
                "job_id": str(job_id),
                "mode": "custom",
                "questions": ["Q11", "Q12", "Q13", "Q14", "Q15"],
                "mcqs": [{"question": "What is FastAPI?", "options": ["framework", "db"], "answer": "framework"}],
                "project_task": "Task B",
            }
            response = client.post("/api/v1/task-papers/assign", json=assign_job_payload_b)
            assert response.status_code == 200
            new_job_paper_id = response.json()["id"]

            # Query candidate's paper -> should still show candidate-specific locked paper (Task A)
            # but job_default_paper_changed should be True!
            response = client.get(f"/api/v1/task-papers/assigned/{candidate_id}")
            assert response.status_code == 200
            res_json = response.json()
            assert res_json["id"] == str(candidate_paper_id)
            assert res_json["project_task"] == [{"task": "Task A", "instructions": ""}]
            assert len(res_json["mcqs"]) == 1
            assert res_json["mcqs"][0]["question"] == "What is Python?"
            assert res_json["job_default_paper_changed"] is True
            assert res_json["job_default_paper_name"] == "Custom Test Paper"
            assert res_json["job_default_paper_id"] == new_job_paper_id

            # 5. Email new default paper to candidate to verify reassignment and history (needs force=True because email was already sent once)
            email_payload_b = {
                "candidate_email": candidate_email,
                "paper_id": new_job_paper_id,
                "force": True,
            }
            response = client.post("/api/v1/task-papers/send-email", json=email_payload_b)
            assert response.status_code == 200

            # Check history log -> should now contain 2 log entries (newest first)
            response = client.get(f"/api/v1/task-papers/assigned/{candidate_id}/history")
            assert response.status_code == 200
            history = response.json()
            assert len(history) == 2
            assert history[0]["project_task"] == [{"task": "Task B", "instructions": ""}]
            assert history[1]["project_task"] == [{"task": "Task A", "instructions": ""}]
            assert len(history[0]["mcqs"]) == 1
            assert history[0]["mcqs"][0]["question"] == "What is FastAPI?"
            assert len(history[1]["mcqs"]) == 1
            assert history[1]["mcqs"][0]["question"] == "What is Python?"

            # Check job history log -> should contain the same 2 log entries
            response = client.get(f"/api/v1/task-papers/assigned/job/{job_id}/history")
            assert response.status_code == 200
            job_history = response.json()
            assert len(job_history) == 2
            assert job_history[0]["project_task"] == [{"task": "Task B", "instructions": ""}]
            assert job_history[1]["project_task"] == [{"task": "Task A", "instructions": ""}]
            assert len(job_history[0]["mcqs"]) == 1
            assert job_history[0]["mcqs"][0]["question"] == "What is FastAPI?"
            assert len(job_history[1]["mcqs"]) == 1
            assert job_history[1]["mcqs"][0]["question"] == "What is Python?"


            # 6. Complete stage Technical Practical Round in DB
            async with engine.begin() as conn:
                await conn.execute(
                    text("UPDATE candidate_stages SET status = 'completed' WHERE id = :id"),
                    {"id": candidate_stage_id},
                )

            # Try to assign paper again -> should be blocked with HTTP 400
            assign_blocked_payload = {
                "candidate_id": str(candidate_id),
                "mode": "custom",
                "questions": ["Q21", "Q22", "Q23", "Q24", "Q25"],
                "project_task": "Task C",
            }
            response = client.post("/api/v1/task-papers/assign", json=assign_blocked_payload)
            assert response.status_code == 400
            assert "completed the Technical Practical Round" in response.json()["detail"]

            # Try to unassign paper -> should be blocked with HTTP 400
            response = client.delete(f"/api/v1/task-papers/assigned/{candidate_id}")
            assert response.status_code == 400
            assert "completed the Technical Practical Round" in response.json()["detail"]

    finally:
        app.dependency_overrides.clear()
        # Clean up database records
        async with engine.begin() as conn:
            await conn.execute(text("DELETE FROM candidate_test_paper_histories WHERE candidate_id = :id"), {"id": candidate_id})
            await conn.execute(text("DELETE FROM candidate_test_papers WHERE job_id = :id"), {"id": job_id})
            await conn.execute(text("DELETE FROM candidate_stages WHERE id = :id"), {"id": candidate_stage_id})
            await conn.execute(text("DELETE FROM job_stage_configs WHERE id = :id"), {"id": job_stage_id})
            await conn.execute(text("DELETE FROM stage_templates WHERE id = :id"), {"id": template_id})
            await conn.execute(text("DELETE FROM candidates WHERE id = :id"), {"id": candidate_id})
            await conn.execute(text("DELETE FROM jobs WHERE id = :id"), {"id": job_id})
            await conn.execute(text("DELETE FROM job_positions WHERE id = :id"), {"id": position_id})
            await conn.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
            await conn.execute(text("DELETE FROM roles WHERE id = :id"), {"id": role_id})
