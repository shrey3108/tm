import uuid
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch

from github_code_evaluator.app.main import app
from github_code_evaluator.app.v1.db.session import get_db
from github_code_evaluator.app.v1.core.security import get_current_user
from github_code_evaluator.app.v1.db.models.role_config import RoleWeightConfig
from github_code_evaluator.app.v1.db.models.repository import Repository
from github_code_evaluator.app.v1.db.models.evaluation import Evaluation


# User Session Mocks
def override_get_user_admin():
    return {"sub": "admin_user", "role": "admin"}

def override_get_user_reviewer():
    return {"sub": "reviewer_user", "role": "reviewer"}


@pytest.fixture
def client():
    yield TestClient(app)
    app.dependency_overrides.clear()


@patch("github_code_evaluator.app.v1.endpoints.repositories.check_url_accessibility")
@patch("github_code_evaluator.workers.tasks.run_evaluation_task.delay")
def test_submit_repository_with_explicit_skills(mock_celery, mock_check, client):
    """Verify that when jd_skills is provided explicitly, it is preserved exactly."""
    app.dependency_overrides[get_current_user] = override_get_user_reviewer
    mock_check.return_value = True

    mock_db = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.flush = AsyncMock()
    mock_db.refresh = AsyncMock()
    mock_db.rollback = AsyncMock()

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    added_repos = []
    def mock_add(obj):
        for attr in ["repository_id", "evaluation_id", "id"]:
            if hasattr(obj, attr) and getattr(obj, attr, None) is None:
                setattr(obj, attr, uuid.uuid4())
        if isinstance(obj, Repository):
            added_repos.append(obj)
    mock_db.add.side_effect = mock_add

    async def get_db_override():
        yield mock_db

    app.dependency_overrides[get_db] = get_db_override

    payload = {
        "github_url": "https://github.com/AtulPal31/medical-chatbot-mvp",
        "job_title": "Python AI Engineer",
        "job_position": "Junior",
        "jd_skills": ["CustomPy", "CustomAI"]
    }

    response = client.post("/api/v1/repositories", json=payload)
    assert response.status_code == 201
    assert len(added_repos) == 1
    assert added_repos[0].jd_skills == ["CustomPy", "CustomAI"]


@patch("github_code_evaluator.app.v1.endpoints.repositories.check_url_accessibility")
@patch("github_code_evaluator.workers.tasks.run_evaluation_task.delay")
def test_submit_repository_db_default_skills_fallback(mock_celery, mock_check, client):
    """Verify that when jd_skills is not provided, the API pulls default_skills from DB RoleWeightConfig."""
    app.dependency_overrides[get_current_user] = override_get_user_reviewer
    mock_check.return_value = True

    mock_db = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.flush = AsyncMock()
    mock_db.refresh = AsyncMock()
    mock_db.rollback = AsyncMock()

    mock_role_config = RoleWeightConfig(
        role_name="Specialized Cloud Architect",
        weights={
            "correctness": 0.25,
            "code_quality": 0.20,
            "architecture": 0.20,
            "security": 0.10,
            "performance": 0.10,
            "documentation": 0.15,
        },
        default_skills=["AWS", "Terraform", "Kubernetes"],
        version=1
    )

    mock_result_empty = MagicMock()
    mock_result_empty.scalar_one_or_none.return_value = None

    mock_result_role = MagicMock()
    mock_result_role.scalar_one_or_none.return_value = mock_role_config

    async def mock_execute(query):
        query_str = str(query).lower()
        if "role_weight_configs" in query_str:
            return mock_result_role
        return mock_result_empty

    mock_db.execute = mock_execute

    added_repos = []
    def mock_add(obj):
        for attr in ["repository_id", "evaluation_id", "id"]:
            if hasattr(obj, attr) and getattr(obj, attr, None) is None:
                setattr(obj, attr, uuid.uuid4())
        if isinstance(obj, Repository):
            added_repos.append(obj)
    mock_db.add.side_effect = mock_add

    async def get_db_override():
        yield mock_db

    app.dependency_overrides[get_db] = get_db_override

    payload = {
        "github_url": "https://github.com/AtulPal31/medical-chatbot-mvp",
        "job_title": "Specialized Cloud Architect",
        "job_position": "Junior",
        "jd_skills": None
    }

    response = client.post("/api/v1/repositories", json=payload)
    assert response.status_code == 201
    assert len(added_repos) == 1
    assert added_repos[0].jd_skills == ["AWS", "Terraform", "Kubernetes"]


@patch("github_code_evaluator.app.v1.endpoints.repositories.check_url_accessibility")
@patch("github_code_evaluator.workers.tasks.run_evaluation_task.delay")
def test_submit_repository_db_missing_skills_resolves_empty(mock_celery, mock_check, client):
    """Verify that when jd_skills is not provided, and DB config is missing, it resolves to an empty list []."""
    app.dependency_overrides[get_current_user] = override_get_user_reviewer
    mock_check.return_value = True

    mock_db = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.flush = AsyncMock()
    mock_db.refresh = AsyncMock()
    mock_db.rollback = AsyncMock()

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    added_repos = []
    def mock_add(obj):
        for attr in ["repository_id", "evaluation_id", "id"]:
            if hasattr(obj, attr) and getattr(obj, attr, None) is None:
                setattr(obj, attr, uuid.uuid4())
        if isinstance(obj, Repository):
            added_repos.append(obj)
    mock_db.add.side_effect = mock_add

    async def get_db_override():
        yield mock_db

    app.dependency_overrides[get_db] = get_db_override

    payload = {
        "github_url": "https://github.com/AtulPal31/medical-chatbot-mvp",
        "job_title": "Non-existent Special Role",
        "job_position": "Junior",
        "jd_skills": []
    }

    response = client.post("/api/v1/repositories", json=payload)
    assert response.status_code == 201
    assert len(added_repos) == 1
    assert added_repos[0].jd_skills == []


@patch("github_code_evaluator.app.v1.endpoints.repositories.check_url_accessibility")
@patch("github_code_evaluator.workers.tasks.run_evaluation_task.delay")
def test_submit_repository_case_insensitive_db_lookup(mock_celery, mock_check, client):
    """Verify that role names are matched case-insensitively in the DB lookup."""
    app.dependency_overrides[get_current_user] = override_get_user_reviewer
    mock_check.return_value = True

    mock_db = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.flush = AsyncMock()
    mock_db.refresh = AsyncMock()
    mock_db.rollback = AsyncMock()

    mock_role_config = RoleWeightConfig(
        role_name="Python AI Engineer",
        weights={
            "correctness": 0.25,
            "code_quality": 0.20,
            "architecture": 0.20,
            "security": 0.10,
            "performance": 0.10,
            "documentation": 0.15,
        },
        default_skills=["Python", "FastAPI", "LangChain", "LLMs", "RAG"],
        version=1
    )

    mock_result_empty = MagicMock()
    mock_result_empty.scalar_one_or_none.return_value = None

    mock_result_role = MagicMock()
    mock_result_role.scalar_one_or_none.return_value = mock_role_config

    async def mock_execute(query):
        query_str = str(query).lower()
        if "role_weight_configs" in query_str:
            return mock_result_role
        return mock_result_empty

    mock_db.execute = mock_execute

    added_repos = []
    def mock_add(obj):
        for attr in ["repository_id", "evaluation_id", "id"]:
            if hasattr(obj, attr) and getattr(obj, attr, None) is None:
                setattr(obj, attr, uuid.uuid4())
        if isinstance(obj, Repository):
            added_repos.append(obj)
    mock_db.add.side_effect = mock_add

    async def get_db_override():
        yield mock_db

    app.dependency_overrides[get_db] = get_db_override

    payload = {
        "github_url": "https://github.com/AtulPal31/medical-chatbot-mvp",
        "job_title": "  pYtHoN aI eNgInEeR  ",  # Checks casing and whitespace trimming
        "job_position": "Junior",
        "jd_skills": None
    }

    response = client.post("/api/v1/repositories", json=payload)
    assert response.status_code == 201
    assert len(added_repos) == 1
    assert added_repos[0].jd_skills == ["Python", "FastAPI", "LangChain", "LLMs", "RAG"]


def test_post_weights_admin_with_default_skills(client):
    """Verify that admin can successfully save custom weights along with default_skills."""
    app.dependency_overrides[get_current_user] = override_get_user_admin

    mock_db = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.flush = AsyncMock()
    mock_db.refresh = AsyncMock()
    mock_db.rollback = AsyncMock()
    
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)
    
    added_configs = []
    def mock_add(obj):
        if hasattr(obj, "role_weight_config_id") and obj.role_weight_config_id is None:
            obj.role_weight_config_id = uuid.uuid4()
        if isinstance(obj, RoleWeightConfig):
            added_configs.append(obj)
    mock_db.add.side_effect = mock_add

    async def get_db_override():
        yield mock_db

    app.dependency_overrides[get_db] = get_db_override

    payload = {
        "role_name": "Go Developer",
        "weights": {
            "correctness": 0.25,
            "code_quality": 0.20,
            "architecture": 0.20,
            "security": 0.10,
            "performance": 0.10,
            "documentation": 0.15,
        },
        "default_skills": ["Go", "Gin", "Docker"]
    }
    response = client.post("/api/v1/configs/weights", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["role_name"] == "Go Developer"
    assert data["default_skills"] == ["Go", "Gin", "Docker"]
    assert len(added_configs) == 1
    assert added_configs[0].default_skills == ["Go", "Gin", "Docker"]
