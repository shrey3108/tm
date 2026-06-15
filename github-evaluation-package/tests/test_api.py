import uuid
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch

import github_code_evaluator.workers.tasks
from github_code_evaluator.app.main import app
from github_code_evaluator.app.v1.db.session import get_db
from github_code_evaluator.app.v1.core.security import get_current_user


# Mock Database session dependency override
async def override_get_db():
    db = MagicMock()
    db.commit = AsyncMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    db.rollback = AsyncMock()
    
    # Mock execute to return a mock query result with scalars
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_result.scalar_one_or_none.return_value = None
    db.execute = AsyncMock(return_value=mock_result)
    
    # Mock add synchronously to assign simulated UUID primary key IDs
    def mock_add(obj):
        for attr in ["repository_id", "evaluation_id", "category_id", "evaluation_score_id", "evaluation_report_id", "security_result_id", "override_log_id", "prompt_id", "role_weight_config_id", "id"]:
            if hasattr(obj, attr) and getattr(obj, attr, None) is None:
                setattr(obj, attr, uuid.uuid4())
    db.add.side_effect = mock_add
    
    yield db


# Mock User session dependency overrides
def override_get_user_admin():
    return {"sub": "admin_user", "role": "admin"}


def override_get_user_reviewer():
    return {"sub": "reviewer_user", "role": "reviewer"}


def override_get_user_candidate():
    return {"sub": "candidate_user", "role": "user"}


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_root_endpoint(client):
    """Verify standard response of root service index."""
    response = client.get("/")
    assert response.status_code == 200
    assert "GitHub Code Evaluator" in response.json()["message"]


def test_submit_repository_unauthorized(client):
    """Verify repository submission fails when invalid/expired token is provided."""
    # Remove standard user overrides
    if get_current_user in app.dependency_overrides:
        del app.dependency_overrides[get_current_user]

    payload = {
        "github_url": "https://github.com/AtulPal31/medical-chatbot-mvp",
        "job_title": "Python AI Engineer",
        "job_position": "Junior",
    }
    # Pass an invalid Bearer token to trigger the JWT invalid token validation flow
    response = client.post(
        "/api/v1/repositories",
        json=payload,
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert response.status_code == 401
    assert "Invalid token" in response.json()["detail"]


@patch("github_code_evaluator.app.v1.endpoints.repositories.check_url_accessibility")
def test_submit_repository_invalid_url(mock_check, client):
    """Verify submission fails on invalid URL structure with 422 validation code."""
    app.dependency_overrides[get_current_user] = override_get_user_reviewer
    mock_check.return_value = False

    payload = {
        "github_url": "ftp://bad-url.git",
        "job_title": "Python AI Engineer",
        "job_position": "Junior",
    }
    response = client.post("/api/v1/repositories", json=payload)
    # Pydantic field validator fails and returns 422 Unprocessable Entity
    assert response.status_code == 422


@patch("github_code_evaluator.app.v1.endpoints.repositories.check_url_accessibility")
@patch("github_code_evaluator.workers.tasks.run_evaluation_task.delay")
def test_submit_repository_success(mock_celery, mock_check, client):
    """Verify successful submission and task dispatch."""
    app.dependency_overrides[get_current_user] = override_get_user_reviewer
    mock_check.return_value = True

    payload = {
        "github_url": "https://github.com/AtulPal31/medical-chatbot-mvp",
        "job_title": "Python AI Engineer",
        "job_position": "Junior",
    }

    response = client.post("/api/v1/repositories", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "queued"
    assert "repository_id" in data
    assert mock_celery.called


@patch("github_code_evaluator.app.v1.endpoints.repositories.check_url_accessibility")
@patch("github_code_evaluator.workers.tasks.run_evaluation_task.delay")
def test_submit_repository_defaults_hr_email(mock_celery, mock_check, client):
    """Verify that submitting without recruiter_email defaults recruiter_email to settings.HR_EMAIL."""
    app.dependency_overrides[get_current_user] = override_get_user_reviewer
    mock_check.return_value = True

    from github_code_evaluator.app.v1.core.config import settings
    mock_db = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.flush = AsyncMock()
    mock_db.refresh = AsyncMock()
    mock_db.rollback = AsyncMock()
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)
    
    added_evaluations = []
    def mock_add(obj):
        for attr in ["repository_id", "evaluation_id", "category_id", "evaluation_score_id", "evaluation_report_id", "security_result_id", "override_log_id", "prompt_id", "role_weight_config_id", "id"]:
            if hasattr(obj, attr) and getattr(obj, attr, None) is None:
                setattr(obj, attr, uuid.uuid4())
        from github_code_evaluator.app.v1.db.models.evaluation import Evaluation
        if isinstance(obj, Evaluation):
            added_evaluations.append(obj)
    mock_db.add.side_effect = mock_add

    async def get_db_override():
        yield mock_db

    app.dependency_overrides[get_db] = get_db_override

    payload = {
        "github_url": "https://github.com/AtulPal31/medical-chatbot-mvp",
        "job_title": "Python AI Engineer",
        "job_position": "Junior",
    }

    response = client.post("/api/v1/repositories", json=payload)
    assert response.status_code == 201
    assert len(added_evaluations) == 1
    assert added_evaluations[0].recruiter_email == settings.HR_EMAIL


def test_list_weights_configs(client):
    """Verify listing weight configurations."""
    app.dependency_overrides[get_current_user] = override_get_user_reviewer

    response = client.get("/api/v1/configs/weights")
    assert response.status_code == 200
    configs = response.json()
    assert len(configs) >= 1
    assert configs[0]["role_name"] == "default"


def test_list_weights_configs_filter(client):
    """Verify listing weight configurations with name filter."""
    app.dependency_overrides[get_current_user] = override_get_user_reviewer

    # Search for "default" config which should match and return the default config
    response = client.get("/api/v1/configs/weights?role_name=def")
    assert response.status_code == 200
    configs = response.json()
    assert len(configs) == 1
    assert configs[0]["role_name"] == "default"

    # Search for a name that matches nothing, which should return empty list
    response = client.get("/api/v1/configs/weights?role_name=nonexistentrole")
    assert response.status_code == 200
    configs = response.json()
    assert len(configs) == 0


def test_override_score_forbidden_for_candidate(client):
    """Verify candidate/user role cannot override scores."""
    app.dependency_overrides[get_current_user] = override_get_user_candidate

    eval_id = uuid.uuid4()
    payload = {
        "category": "security",
        "score": 9.0,
        "notes": "Override notes",
    }
    response = client.post(f"/api/v1/evaluations/{eval_id}/override", json=payload)
    assert response.status_code == 403
    assert "Only reviewers and admin" in response.json()["detail"]


def test_submit_repository_cached(client):
    """Verify submitting a repository that has already been evaluated returns the cached result."""
    app.dependency_overrides[get_current_user] = override_get_user_admin

    # Mock DB query to return an existing completed evaluation with matching job details
    mock_eval = MagicMock()
    mock_eval.evaluation_id = uuid.uuid4()
    mock_eval.repository_id = uuid.uuid4()
    mock_eval.status = "complete"
    mock_eval.job_title = "Python AI Engineer"
    mock_eval.job_description = ""

    async def mock_get_db_with_cached():
        db = MagicMock()
        db.commit = AsyncMock()
        db.flush = AsyncMock()
        db.refresh = AsyncMock()
        db.rollback = AsyncMock()
        
        mock_result = MagicMock()
        # First call to db.execute for checking existing evaluation
        mock_result.scalar_one_or_none.return_value = mock_eval
        db.execute = AsyncMock(return_value=mock_result)
        yield db

    app.dependency_overrides[get_db] = mock_get_db_with_cached

    payload = {
        "github_url": "https://github.com/AtulPal31/medical-chatbot-mvp",
        "job_title": "Python AI Engineer",
        "job_position": "Junior",
    }
    
    with patch("github_code_evaluator.app.v1.endpoints.repositories.check_url_accessibility", return_value=True):
        response = client.post("/api/v1/repositories", json=payload)

    assert response.status_code == 409
    assert "Repository has already been submitted for evaluation." in response.json()["detail"]


@patch("github_code_evaluator.app.v1.endpoints.repositories.check_url_accessibility")
@patch("github_code_evaluator.workers.tasks.run_evaluation_task.delay")
def test_submit_repository_not_cached_different_jd(mock_celery, mock_check, client):
    """Verify that submitting the same repo URL with a different job title still returns the duplicate evaluation."""
    app.dependency_overrides[get_current_user] = override_get_user_reviewer
    mock_check.return_value = True

    mock_eval = MagicMock()
    mock_eval.id = uuid.uuid4()
    mock_eval.repository_id = uuid.uuid4()
    mock_eval.status = "complete"

    async def mock_get_db_with_cached():
        db = MagicMock()
        db.commit = AsyncMock()
        db.flush = AsyncMock()
        db.refresh = AsyncMock()
        db.rollback = AsyncMock()
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_eval
        db.execute = AsyncMock(return_value=mock_result)
        # Synchronous add side-effect for simulated IDs
        def mock_add(obj):
            for attr in ["repository_id", "evaluation_id", "category_id", "evaluation_score_id", "evaluation_report_id", "security_result_id", "override_log_id", "prompt_id", "role_weight_config_id", "id"]:
                if hasattr(obj, attr) and getattr(obj, attr, None) is None:
                    setattr(obj, attr, uuid.uuid4())
        db.add.side_effect = mock_add
        yield db

    app.dependency_overrides[get_db] = mock_get_db_with_cached

    payload = {
        "github_url": "https://github.com/AtulPal31/medical-chatbot-mvp",
        "job_title": "Senior AI Architect",  # Different job title
        "job_position": "Senior",
    }

    response = client.post("/api/v1/repositories", json=payload)
    assert response.status_code == 409
    assert "Repository has already been submitted for evaluation." in response.json()["detail"]
    assert not mock_celery.called


@patch("github_code_evaluator.app.v1.endpoints.repositories.check_url_accessibility")
@patch("github_code_evaluator.workers.tasks.run_evaluation_task.delay")
def test_submit_repository_with_skills_different_cache(mock_celery, mock_check, client):
    """Verify that submitting the same repo URL with different skill requirements still returns the duplicate evaluation."""
    app.dependency_overrides[get_current_user] = override_get_user_reviewer
    mock_check.return_value = True

    mock_eval = MagicMock()
    mock_eval.id = uuid.uuid4()
    mock_eval.repository_id = uuid.uuid4()
    mock_eval.status = "complete"

    async def mock_get_db_with_cached():
        db = MagicMock()
        db.commit = AsyncMock()
        db.flush = AsyncMock()
        db.refresh = AsyncMock()
        db.rollback = AsyncMock()
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_eval
        db.execute = AsyncMock(return_value=mock_result)
        # Synchronous add side-effect for simulated IDs
        def mock_add(obj):
            for attr in ["repository_id", "evaluation_id", "category_id", "evaluation_score_id", "evaluation_report_id", "security_result_id", "override_log_id", "prompt_id", "role_weight_config_id", "id"]:
                if hasattr(obj, attr) and getattr(obj, attr, None) is None:
                    setattr(obj, attr, uuid.uuid4())
        db.add.side_effect = mock_add
        yield db

    app.dependency_overrides[get_db] = mock_get_db_with_cached

    payload = {
        "github_url": "https://github.com/AtulPal31/medical-chatbot-mvp",
        "job_title": "Python AI Engineer",
        "job_position": "Junior",
        "jd_skills": ["Python", "LangChain", "FastAPI"],
        "project_required_skills": ["RAG", "Vector DB"],
    }

    response = client.post("/api/v1/repositories", json=payload)
    assert response.status_code == 409
    assert "Repository has already been submitted for evaluation." in response.json()["detail"]
    assert not mock_celery.called


def test_post_weights_admin_success(client):
    """Verify that admin can successfully save custom weights (even when sum != 1.0)."""
    app.dependency_overrides[get_current_user] = override_get_user_admin

    payload = {
        "role_name": "Python AI Engineer",
        "weights": {
            "correctness": 0.25,
            "code_quality": 0.20,
            "architecture": 0.20,
            "security": 0.10,
            "performance": 0.10,
            "documentation": 0.15,
        }
    }
    response = client.post("/api/v1/configs/weights", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["role_name"] == "Python AI Engineer"
    assert data["weights"]["correctness"] == 0.25
    assert data["weights"]["documentation"] == 0.15


def test_post_weights_forbidden_for_reviewer(client):
    """Verify that reviewer cannot save weights config."""
    app.dependency_overrides[get_current_user] = override_get_user_reviewer

    payload = {
        "role_name": "Python AI Engineer",
        "weights": {
            "correctness": 0.25,
            "code_quality": 0.20,
            "architecture": 0.20,
            "security": 0.10,
            "performance": 0.10,
            "documentation": 0.15,
        }
    }
    response = client.post("/api/v1/configs/weights", json=payload)
    assert response.status_code == 403
    assert "Only admin users can configure weights" in response.json()["detail"]


def test_submit_repository_non_github_url(client):
    """Verify that submitting a non-GitHub repository URL is rejected with 400 Bad Request."""
    app.dependency_overrides[get_current_user] = override_get_user_reviewer

    payload = {
        "github_url": "https://gitlab.com/some/repo",
        "job_title": "Python AI Engineer",
        "job_position": "Junior",
    }
    response = client.post("/api/v1/repositories", json=payload)
    assert response.status_code == 400
    assert "Invalid GitHub repository URL format" in response.json()["detail"]


def test_get_dev_token_success(client):
    """Verify that a token is successfully generated in development mode."""
    response = client.get("/api/v1/auth/token?sub=test_user&role=reviewer")
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["sub"] == "test_user"
    assert data["role"] == "reviewer"


def test_get_dev_token_invalid_role(client):
    """Verify that an invalid role is rejected."""
    response = client.get("/api/v1/auth/token?role=invalid")
    assert response.status_code == 400
    assert "Invalid role" in response.json()["detail"]


def test_get_dev_token_non_dev_forbidden(client):
    """Verify that the endpoint is forbidden if the environment is not development."""
    from github_code_evaluator.app.v1.core.config import settings
    original_env = settings.ENVIRONMENT
    settings.ENVIRONMENT = "production"
    try:
        response = client.get("/api/v1/auth/token")
        assert response.status_code == 403
        assert "only available in development mode" in response.json()["detail"]
    finally:
        settings.ENVIRONMENT = original_env


@patch("github_code_evaluator.app.v1.endpoints.repositories.check_url_accessibility")
@patch("github_code_evaluator.workers.tasks.run_evaluation_task.delay")
def test_submit_repository_allowed_when_failed(mock_celery, mock_check, client):
    """Verify that submitting a repository with an existing 'failed' status is allowed and triggers a new task."""
    app.dependency_overrides[get_current_user] = override_get_user_reviewer
    mock_check.return_value = True

    # Existing failed evaluation
    mock_eval = MagicMock()
    mock_eval.evaluation_id = uuid.uuid4()
    mock_eval.repository_id = uuid.uuid4()
    mock_eval.status = "failed"
    mock_eval.job_title = "Python AI Engineer"

    async def mock_get_db_with_failed():
        db = MagicMock()
        db.commit = AsyncMock()
        db.flush = AsyncMock()
        db.refresh = AsyncMock()
        db.rollback = AsyncMock()
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_eval
        db.execute = AsyncMock(return_value=mock_result)
        
        # Synchronous add side-effect for simulated IDs
        def mock_add(obj):
            for attr in ["repository_id", "evaluation_id", "id"]:
                if hasattr(obj, attr) and getattr(obj, attr, None) is None:
                    setattr(obj, attr, uuid.uuid4())
        db.add.side_effect = mock_add
        yield db

    app.dependency_overrides[get_db] = mock_get_db_with_failed

    payload = {
        "github_url": "https://github.com/AtulPal31/medical-chatbot-mvp",
        "job_title": "Python AI Engineer",
        "job_position": "Junior",
    }

    response = client.post("/api/v1/repositories", json=payload)
    # Check that it returns HTTP 201 Created instead of HTTP 409 Conflict
    assert response.status_code == 201
    assert response.json()["status"] == "queued"
    assert mock_celery.called


def test_delete_repository_by_id_success(client):
    """Verify deleting a repository by ID is successful."""
    app.dependency_overrides[get_current_user] = override_get_user_admin

    mock_repo = MagicMock()
    mock_repo.repository_id = uuid.uuid4()

    async def mock_get_db_with_repo():
        db = MagicMock()
        db.execute = AsyncMock()
        db.delete = AsyncMock()
        db.commit = AsyncMock()
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_repo
        db.execute.return_value = mock_result
        yield db

    app.dependency_overrides[get_db] = mock_get_db_with_repo

    response = client.delete(f"/api/v1/repositories/{mock_repo.repository_id}")
    assert response.status_code == 200
    assert "deleted successfully" in response.json()["message"]


def test_delete_repository_by_url_success(client):
    """Verify deleting a repository by GitHub URL is successful."""
    app.dependency_overrides[get_current_user] = override_get_user_admin

    mock_repo = MagicMock()
    mock_repo.github_url = "https://github.com/test/repo"

    async def mock_get_db_with_repo():
        db = MagicMock()
        db.execute = AsyncMock()
        db.delete = AsyncMock()
        db.commit = AsyncMock()
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_repo
        db.execute.return_value = mock_result
        yield db

    app.dependency_overrides[get_db] = mock_get_db_with_repo

    response = client.delete("/api/v1/repositories", params={"github_url": mock_repo.github_url})
    assert response.status_code == 200
    assert "deleted successfully" in response.json()["message"]


def test_delete_repository_not_found(client):
    """Verify deleting a non-existent repository returns 404."""
    app.dependency_overrides[get_current_user] = override_get_user_admin

    async def mock_get_db_empty():
        db = MagicMock()
        db.execute = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute.return_value = mock_result
        yield db

    app.dependency_overrides[get_db] = mock_get_db_empty

    response = client.delete(f"/api/v1/repositories/{uuid.uuid4()}")
    assert response.status_code == 404
    assert "Repository not found" in response.json()["detail"]




