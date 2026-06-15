import uuid
from pathlib import Path
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from github_code_evaluator.app.main import app
from github_code_evaluator.app.v1.core.security import get_current_user
from github_code_evaluator.app.v1.endpoints.logs import LOG_FILE_PATH

# Mock users for testing role restrictions
def mock_get_user_admin():
    return {"sub": "admin_user", "role": "admin"}

def mock_get_user_reviewer():
    return {"sub": "reviewer_user", "role": "reviewer"}

def mock_get_user_candidate():
    return {"sub": "candidate_user", "role": "candidate"}


@pytest.fixture
def test_log_file():
    """Fixture that prepares a mock log file and cleans it up after the test."""
    # Ensure logs directory exists
    LOG_FILE_PATH.parent.mkdir(exist_ok=True)
    
    # Write mock logs
    eval_id1 = str(uuid.uuid4())
    eval_id2 = str(uuid.uuid4())
    
    lines = [
        f"2026-05-28 12:00:00 [INFO] app.main: Startup completed.",
        f"2026-05-28 12:01:00 [INFO] workers.tasks: [{eval_id1}] Starting evaluation job.",
        f"2026-05-28 12:01:05 [INFO] workers.tasks: [{eval_id1}] Clone succeeded.",
        f"2026-05-28 12:02:00 [INFO] workers.tasks: [{eval_id2}] Starting evaluation job.",
        f"2026-05-28 12:02:10 [ERROR] workers.tasks: [{eval_id2}] LLM call failed.",
    ]
    
    # Save original content if it exists
    original_content = None
    if LOG_FILE_PATH.exists():
        original_content = LOG_FILE_PATH.read_text(encoding="utf-8", errors="replace")
        
    LOG_FILE_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    
    yield (eval_id1, eval_id2)
    
    # Restore original content
    if original_content is not None:
        LOG_FILE_PATH.write_text(original_content, encoding="utf-8")
    elif LOG_FILE_PATH.exists():
        LOG_FILE_PATH.unlink()


def test_get_logs_as_admin(test_log_file):
    """Verify admins can access the logs."""
    app.dependency_overrides[get_current_user] = mock_get_user_admin
    client = TestClient(app)
    
    response = client.get("/api/v1/logs?limit=5")
    assert response.status_code == 200
    data = response.json()
    assert "logs" in data
    assert len(data["logs"]) >= 5
    
    app.dependency_overrides.clear()


def test_get_logs_as_reviewer(test_log_file):
    """Verify reviewers can access the logs."""
    app.dependency_overrides[get_current_user] = mock_get_user_reviewer
    client = TestClient(app)
    
    response = client.get("/api/v1/logs?limit=2")
    assert response.status_code == 200
    data = response.json()
    assert "logs" in data
    assert len(data["logs"]) >= 2
    
    app.dependency_overrides.clear()


def test_get_logs_as_candidate_forbidden(test_log_file):
    """Verify candidates are forbidden from accessing logs."""
    app.dependency_overrides[get_current_user] = mock_get_user_candidate
    client = TestClient(app)
    
    response = client.get("/api/v1/logs")
    assert response.status_code == 403
    assert "Only reviewers and admin" in response.json()["detail"]
    
    app.dependency_overrides.clear()


def test_filter_logs_by_evaluation_id(test_log_file):
    """Verify logs can be filtered by evaluation ID."""
    eval_id1, eval_id2 = test_log_file
    app.dependency_overrides[get_current_user] = mock_get_user_admin
    client = TestClient(app)
    
    # Filter for first evaluation ID
    response = client.get(f"/api/v1/logs?evaluation_id={eval_id1}")
    assert response.status_code == 200
    data = response.json()
    assert len(data["logs"]) == 2
    assert all(eval_id1 in line for line in data["logs"])
    assert "Starting evaluation job" in data["logs"][0]
    assert "Clone succeeded" in data["logs"][1]
    
    # Filter for second evaluation ID
    response = client.get(f"/api/v1/logs?evaluation_id={eval_id2}")
    assert response.status_code == 200
    data2 = response.json()
    assert len(data2["logs"]) == 2
    assert all(eval_id2 in line for line in data2["logs"])
    assert "LLM call failed" in data2["logs"][1]
    
    app.dependency_overrides.clear()
