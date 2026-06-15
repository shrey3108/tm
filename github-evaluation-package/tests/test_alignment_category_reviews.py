import uuid
import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch

from github_code_evaluator.app.main import app
from github_code_evaluator.app.v1.db.session import get_db
from github_code_evaluator.app.v1.core.security import get_current_user
from github_code_evaluator.app.v1.services.llm import AlignmentReportSchema, EvaluationReportSchema
from github_code_evaluator.app.v1.db.models.evaluation import Evaluation
from github_code_evaluator.app.v1.db.models.report import EvaluationReport
from github_code_evaluator.app.v1.db.models.repository import Repository
from github_code_evaluator.app.v1.db.models.score import EvaluationScore

# Mock user dependency override
def override_get_current_user():
    return {"sub": "test_user", "role": "admin"}

@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = override_get_current_user
    yield TestClient(app)
    app.dependency_overrides.clear()

def test_pydantic_schemas_validation():
    """Verify that AlignmentReportSchema and EvaluationReportSchema validate the new category-specific reviews."""
    alignment_data = {
        "strengths": ["Clear structure"],
        "weaknesses": ["Lack of tests"],
        "alignment_review": "Codebase matches skills reasonably.",
        "interview_questions": ["Explain structure?"],
        "scores": {
            "correctness": 4.0,
            "code_quality": 3.5,
            "architecture": 3.0,
            "security": 4.0,
            "performance": 3.5,
            "documentation": 4.5
        },
        "correctness_review": "Correctness review text.",
        "code_quality_review": "Code quality review text.",
        "architecture_review": "Architecture review text.",
        "security_review": "Security review text.",
        "performance_review": "Performance review text.",
        "documentation_review": "Documentation review text."
    }
    
    # 1. Verify AlignmentReportSchema
    align_obj = AlignmentReportSchema(**alignment_data)
    assert align_obj.correctness_review == "Correctness review text."
    assert align_obj.documentation_review == "Documentation review text."
    assert align_obj.scores.correctness == 4.0

    # 2. Verify EvaluationReportSchema
    evaluation_data = {
        "seniority_estimate": "Senior",
        "recommendation": "Proceed",
        "scores": {
            "correctness": 4.0,
            "code_quality": 3.5,
            "architecture": 3.0,
            "security": 4.0,
            "performance": 3.5,
            "documentation": 4.5
        },
        "security_risks": ["Risk A"],
        "architecture_review": "Global Arch Review",
        "code_quality_review": "Global Code Quality",
        "jd_alignment": alignment_data,
        "project_alignment": alignment_data
    }
    eval_obj = EvaluationReportSchema(**evaluation_data)
    assert eval_obj.jd_alignment.correctness_review == "Correctness review text."
    assert eval_obj.project_alignment.performance_review == "Performance review text."
    assert eval_obj.scores.security == 4.0
    assert eval_obj.security_risks == ["Risk A"]
    assert eval_obj.architecture_review == "Global Arch Review"
    assert eval_obj.code_quality_review == "Global Code Quality"


def test_get_report_api_payload_structure(client):
    """Verify that ReportResponse endpoint payload:
    1. Contains new category-specific reviews inside jd_alignment and project_alignment.
    2. Does NOT contain global root-level fields like strengths, weaknesses, interview_questions, scores.
    """
    eval_id = uuid.uuid4()
    repo_id = uuid.uuid4()

    # Create mock DB models
    mock_eval = Evaluation(
        evaluation_id=eval_id,
        repository_id=repo_id,
        status="complete",
        overall_score=3.9,
        recommendation="Proceed",
        llm_model="test-model",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    mock_repo = Repository(
        repository_id=repo_id,
        github_url="https://github.com/example/repo",
        cloned_at=None,
        stack={"Languages": ["Python"]},
        jd_skills=["Python", "FastAPI"],
        project_required_skills=["PostgreSQL"]
    )
    
    mock_score = EvaluationScore(
        evaluation_id=eval_id,
        category="correctness",
        score=4.0,
        weight=0.3,
        weighted_score=1.2
    )

    mock_report = EvaluationReport(
        evaluation_id=eval_id,
        strengths=["Core strength"],
        weaknesses=["Core weakness"],
        security_risks=["Security risk"],
        architecture_review="Root arch review",
        code_quality_review="Root code quality",
        seniority_estimate="Senior",
        interview_questions=["Root question?"],
        jd_alignment_report="JD alignment summary",
        project_alignment_report="Project alignment summary",
        extraordinary_points=["Redis cache used but not in JD"],
        jd_alignment={
            "jd_skills": ["Python"],
            "strengths": ["Matches Python"],
            "weaknesses": ["Gaps in FastAPI"],
            "alignment_review": "JD alignment details.",
            "decision": "Proceed",
            "interview_questions": ["Explain FastAPI?"],
            "scores": {
                "correctness": {"score": 4.0, "weight": 0.3, "weighted_score": 1.2}
            },
            "overall_score": 4.0,
            "correctness_review": "JD Correctness review.",
            "code_quality_review": "JD Code Quality review.",
            "architecture_review": "JD Architecture review.",
            "security_review": "JD Security review.",
            "performance_review": "JD Performance review.",
            "documentation_review": "JD Documentation review."
        },
        project_alignment={
            "project_required_skills": ["PostgreSQL"],
            "strengths": ["Matches PostgreSQL"],
            "weaknesses": [],
            "alignment_review": "Project alignment details.",
            "decision": "Reject",
            "interview_questions": [],
            "scores": {
                "correctness": {"score": 3.5, "weight": 0.3, "weighted_score": 1.05}
            },
            "overall_score": 3.5,
            "correctness_review": "Proj Correctness review.",
            "code_quality_review": "Proj Code Quality review.",
            "architecture_review": "Proj Architecture review.",
            "security_review": "Proj Security review.",
            "performance_review": "Proj Performance review.",
            "documentation_review": "Proj Documentation review."
        }
    )

    # Mock DB dependency to return mock models
    async def override_db():
        db = MagicMock()
        mock_result_eval = MagicMock()
        mock_result_eval.scalar_one_or_none.return_value = mock_eval
        
        mock_result_repo = MagicMock()
        mock_result_repo.scalar_one_or_none.return_value = mock_repo
        
        mock_result_score = MagicMock()
        mock_result_score.scalars.return_value.all.return_value = [mock_score]
        
        mock_result_report = MagicMock()
        mock_result_report.scalar_one_or_none.return_value = mock_report
        
        mock_result_security = MagicMock()
        mock_result_security.scalars.return_value.all.return_value = []
        
        # Sequentially return the query results:
        # 1. Evaluation
        # 2. Repository
        # 3. EvaluationScore
        # 4. EvaluationReport
        # 5. SecurityResult
        db.execute = AsyncMock(side_effect=[
            mock_result_eval,
            mock_result_repo,
            mock_result_score,
            mock_result_report,
            mock_result_security
        ])
        yield db

    app.dependency_overrides[get_db] = override_db

    # Bypass cache service
    with patch("github_code_evaluator.app.v1.endpoints.reports.cache_service.get", return_value=None), \
         patch("github_code_evaluator.app.v1.endpoints.reports.cache_service.set", return_value=None):
        response = client.get(f"/api/v1/evaluations/{eval_id}/report")
    
    assert response.status_code == 200
    data = response.json()
    
    # Verify root level properties
    assert data["evaluation_id"] == str(eval_id)
    assert data["overall_score"] == 3.9
    assert data["recommendation"] == "Proceed"
    assert data["seniority_estimate"] == "Senior"
    
    # Assert root qualitative reviews and scores DO NOT exist (except security_risks, architecture_review, code_quality_review)
    assert "strengths" not in data
    assert "weaknesses" not in data
    assert "scores" not in data
    assert "interview_questions" not in data
 
    assert data["security_risks"] == ["Security risk"]
    assert data["architecture_review"] == "Root arch review"
    assert data["code_quality_review"] == "Root code quality"
    assert data["extraordinary_points"] == ["Redis cache used but not in JD"]

    # Verify jd_alignment properties
    assert data["jd_alignment"]["correctness_review"] == "JD Correctness review."
    assert data["jd_alignment"]["performance_review"] == "JD Performance review."
    assert data["jd_alignment"]["scores"]["correctness"]["score"] == 4.0
    assert data["jd_alignment"]["decision"] == "Proceed"

    # Verify project_alignment properties
    assert data["project_alignment"]["correctness_review"] == "Proj Correctness review."
    assert data["project_alignment"]["performance_review"] == "Proj Performance review."
    assert data["project_alignment"]["scores"]["correctness"]["score"] == 3.5
    assert data["project_alignment"]["decision"] == "Reject"


def test_get_report_html_rendering(client):
    """Verify that the HTML report route renders successfully and includes alignment reviews."""
    eval_id = uuid.uuid4()
    repo_id = uuid.uuid4()

    mock_eval = Evaluation(
        evaluation_id=eval_id,
        repository_id=repo_id,
        status="complete",
        overall_score=3.9,
        recommendation="Proceed",
        llm_model="test-model",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    mock_repo = Repository(
        repository_id=repo_id,
        github_url="https://github.com/example/repo",
        stack={"Languages": ["Python"]}
    )
    mock_score = EvaluationScore(
        evaluation_id=eval_id,
        category="correctness",
        score=4.0,
        weight=0.3,
        weighted_score=1.2
    )
    mock_report = EvaluationReport(
        evaluation_id=eval_id,
        seniority_estimate="Senior",
        security_risks=["Exposed secret found in test file"],
        architecture_review="Overall solid design pattern.",
        extraordinary_points=["Used Celery for background tasks"],
        code_quality_review="Good formatting and pep8 compliant.",
        jd_alignment={
            "jd_skills": ["Python"],
            "strengths": ["Matches Python"],
            "weaknesses": ["Gaps in FastAPI"],
            "alignment_review": "JD alignment details.",
            "interview_questions": ["Explain FastAPI?"],
            "scores": {
                "correctness": {"score": 4.0, "weight": 0.3, "weighted_score": 1.2}
            },
            "overall_score": 4.0,
            "correctness_review": "JD Correctness review.",
            "code_quality_review": "JD Code Quality review.",
            "architecture_review": "JD Architecture review.",
            "security_review": "JD Security review.",
            "performance_review": "JD Performance review.",
            "documentation_review": "JD Documentation review."
        },
        project_alignment={
            "project_required_skills": ["PostgreSQL"],
            "strengths": ["Matches PostgreSQL"],
            "weaknesses": [],
            "alignment_review": "Project alignment details.",
            "interview_questions": [],
            "scores": {
                "correctness": {"score": 3.5, "weight": 0.3, "weighted_score": 1.05}
            },
            "overall_score": 3.5,
            "correctness_review": "Proj Correctness review.",
            "code_quality_review": "Proj Code Quality review.",
            "architecture_review": "Proj Architecture review.",
            "security_review": "Proj Security review.",
            "performance_review": "Proj Performance review.",
            "documentation_review": "Proj Documentation review."
        }
    )

    async def override_db():
        db = MagicMock()
        mock_result_eval = MagicMock()
        mock_result_eval.scalar_one_or_none.return_value = mock_eval
        
        mock_result_repo = MagicMock()
        mock_result_repo.scalar_one_or_none.return_value = mock_repo
        
        mock_result_score = MagicMock()
        mock_result_score.scalars.return_value.all.return_value = [mock_score]
        
        mock_result_report = MagicMock()
        mock_result_report.scalar_one_or_none.return_value = mock_report
        
        mock_result_security = MagicMock()
        mock_result_security.scalars.return_value.all.return_value = []

        db.execute = AsyncMock(side_effect=[
            mock_result_eval,
            mock_result_repo,
            mock_result_score,
            mock_result_report,
            mock_result_security
        ])
        yield db

    app.dependency_overrides[get_db] = override_db

    # Bypass cache service
    with patch("github_code_evaluator.app.v1.endpoints.reports.cache_service.get", return_value=None), \
         patch("github_code_evaluator.app.v1.endpoints.reports.cache_service.set", return_value=None):
        response = client.get(f"/api/v1/evaluations/{eval_id}/html")
    
    assert response.status_code == 200
    html_text = response.text
    
    # Assert presence of key dashboard elements and specific reviews
    assert "Candidate Repository Evaluation" in html_text
    assert "JD Correctness review." in html_text
    assert "Proj Performance review." in html_text
    assert "Overall Category Score Breakdown" not in html_text
    assert "Target URL:" in html_text
    assert "Exposed secret found in test file" in html_text
    assert "Overall solid design pattern." in html_text
    assert "Good formatting and pep8 compliant." in html_text
    assert "Used Celery for background tasks" in html_text
