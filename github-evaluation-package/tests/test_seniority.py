import pytest
from github_code_evaluator.app.v1.services.llm import cap_seniority_estimate

def test_cap_seniority_estimate():
    # Estimated seniority higher than target
    assert cap_seniority_estimate("Junior React Developer", "Senior") == "Junior"
    assert cap_seniority_estimate("Junior React Developer", "Mid-level") == "Junior"
    assert cap_seniority_estimate("Mid-level Python Engineer", "Senior") == "Intermediate"
    assert cap_seniority_estimate("Senior AI Architect", "Staff") == "Senior"
    assert cap_seniority_estimate("Senior AI Architect", "Lead") == "Senior"
    
    # Estimated seniority lower or equal than target
    assert cap_seniority_estimate("Senior AI Architect", "Mid-level") == "Intermediate"
    assert cap_seniority_estimate("Senior AI Architect", "Senior") == "Senior"
    assert cap_seniority_estimate("Staff Software Engineer", "Senior") == "Senior"
    assert cap_seniority_estimate("Staff Software Engineer", "Staff") == "Staff"
    
    # Default target seniority (Mid-level) when no keywords match
    assert cap_seniority_estimate("Software Engineer", "Senior") == "Intermediate"
    assert cap_seniority_estimate("Software Engineer", "Junior") == "Junior"
    assert cap_seniority_estimate("Software Engineer", "Mid-level") == "Intermediate"


def test_get_report_html_hides_seniority_when_reject():
    import uuid
    from datetime import datetime
    from fastapi.testclient import TestClient
    from unittest.mock import AsyncMock, MagicMock, patch

    from github_code_evaluator.app.main import app
    from github_code_evaluator.app.v1.db.session import get_db
    from github_code_evaluator.app.v1.db.models.evaluation import Evaluation
    from github_code_evaluator.app.v1.db.models.report import EvaluationReport
    from github_code_evaluator.app.v1.db.models.repository import Repository
    from github_code_evaluator.app.v1.db.models.score import EvaluationScore

    client = TestClient(app)
    eval_id = uuid.uuid4()
    repo_id = uuid.uuid4()

    mock_eval = Evaluation(
        evaluation_id=eval_id,
        repository_id=repo_id,
        status="complete",
        overall_score=2.2,
        recommendation="Reject",
        llm_model="test-model",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    mock_repo = Repository(
        repository_id=repo_id,
        github_url="https://github.com/example/repo",
        stack={"Languages": ["JavaScript"]}
    )
    mock_score = EvaluationScore(
        evaluation_id=eval_id,
        category="correctness",
        score=2.0,
        weight=0.5,
        weighted_score=1.0
    )
    mock_report = EvaluationReport(
        evaluation_id=eval_id,
        seniority_estimate="N/A",
        security_risks=[],
        architecture_review="Arch review.",
        code_quality_review="Code quality review.",
        jd_alignment={"overall_score": 2.0},
        project_alignment={"overall_score": 2.0}
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

    with patch("github_code_evaluator.app.v1.endpoints.reports.cache_service.get", return_value=None), \
         patch("github_code_evaluator.app.v1.endpoints.reports.cache_service.set", return_value=None):
        response = client.get(f"/api/v1/evaluations/{eval_id}/html")
    
    app.dependency_overrides.clear()
    assert response.status_code == 200
    html_text = response.text
    
    # Should show the recommendation 'Reject' but NOT the 'N/A' seniority badge
    assert "Reject" in html_text
    assert "N/A" not in html_text


def test_combine_reports_extraordinary_score_fallback():
    from github_code_evaluator.app.v1.services.llm import LLMEvaluationService
    service = LLMEvaluationService()
    
    report_code = {
        "security_risks": [],
        "architecture_review": "",
        "code_quality_review": "",
        "architecture_score": 4.0,
        "code_quality_score": 4.0,
        "security_score": 4.0,
        "scores": {
            "correctness": 4.0,
            "code_quality": 4.0,
            "architecture": 4.0,
            "security": 4.0,
            "performance": 4.0,
            "documentation": 4.0
        },
        "jd_alignment": {
            "scores": {
                "correctness": 1.0,
                "code_quality": 1.0,
                "architecture": 1.0,
                "security": 1.0,
                "performance": 1.0,
                "documentation": 1.0
            },
            "correctness_review": "Placeholder Correctness review."
        },
        "project_alignment": {
            "scores": {
                "correctness": 1.0,
                "code_quality": 1.0,
                "architecture": 1.0,
                "security": 1.0,
                "performance": 1.0,
                "documentation": 1.0
            },
            "correctness_review": "Placeholder Correctness review."
        }
    }
    
    # Non-code report has extraordinary points but score is 0.0
    report_non_code = {
        "seniority_estimate": "Senior",
        "recommendation": "Proceed",
        "jd_alignment_report": "",
        "project_alignment_report": "",
        "extraordinary_points": ["Point A", "Point B", "Point C"],
        "extraordinary_score": 0.0,
        "jd_alignment": {
            "strengths": [],
            "weaknesses": [],
            "alignment_review": "",
            "interview_questions": [],
            "decision": "Proceed",
            "scores": {
                "correctness": 4.5,
                "code_quality": 4.0,
                "architecture": 4.0,
                "security": 4.0,
                "performance": 4.0,
                "documentation": 4.0
            },
            "correctness_review": "Actual Non-code JD Correctness review."
        },
        "project_alignment": {
            "strengths": [],
            "weaknesses": [],
            "alignment_review": "",
            "interview_questions": [],
            "decision": "Proceed",
            "scores": {
                "correctness": 3.0,
                "code_quality": 3.5,
                "architecture": 3.5,
                "security": 3.5,
                "performance": 3.5,
                "documentation": 3.5
            },
            "correctness_review": "Actual Non-code Project Correctness review."
        }
    }
    
    combined = service.combine_reports(report_code, report_non_code)
    # Check that fallback computed 5.0 (2.0 + 3 * 1.0 = 5.0)
    assert combined["extraordinary_score"] == 5.0
    
    # Check that alignment scores and reviews are taken from report_non_code
    assert combined["jd_alignment"]["scores"]["correctness"] == 4.5
    assert combined["jd_alignment"]["correctness_review"] == "Actual Non-code JD Correctness review."
    
    assert combined["project_alignment"]["scores"]["correctness"] == 3.0
    assert combined["project_alignment"]["correctness_review"] == "Actual Non-code Project Correctness review."


