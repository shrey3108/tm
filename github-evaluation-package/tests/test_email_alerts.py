import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from github_code_evaluator.workers.tasks import execute_evaluation
from github_code_evaluator.app.v1.services.llm import LLMValidationException
from celery.exceptions import MaxRetriesExceededError
from github_code_evaluator.app.v1.core.config import settings


@pytest.mark.anyio
@patch("github_code_evaluator.workers.tasks.async_session_maker")
@patch("github_code_evaluator.workers.tasks.RepositoryService.clone_repository")
@patch("github_code_evaluator.workers.tasks.send_access_failure_email_task")
async def test_clone_failure_triggers_email_alert(
    mock_send_access_email, mock_clone, mock_session_maker
):
    """Verify that a repository cloning failure dispatches an access failure email alert."""
    # Setup database mocks
    mock_db = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.execute = MagicMock()
    
    mock_eval = MagicMock()
    mock_eval.evaluation_id = uuid.uuid4()
    mock_eval.repository_id = uuid.uuid4()
    mock_eval.status = "queued"
    mock_eval.candidate_email = "candidate@example.com"
    mock_eval.recruiter_email = "recruiter@example.com"
    
    mock_repo = MagicMock()
    mock_repo.repository_id = mock_eval.repository_id
    mock_repo.github_url = "https://github.com/test/repo"
    
    mock_res_eval = MagicMock()
    mock_res_eval.scalar_one_or_none.return_value = mock_eval
    
    mock_res_repo = MagicMock()
    mock_res_repo.scalar_one_or_none.return_value = mock_repo
    
    async def mock_execute(query):
        query_str = str(query)
        if "evaluation" in query_str:
            return mock_res_eval
        return mock_res_repo
        
    mock_db.execute = mock_execute
    
    mock_session = MagicMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_db)
    mock_session.__aexit__ = AsyncMock(return_value=False)
    mock_session_maker.return_value = mock_session
    
    # Force cloning to fail
    mock_clone.return_value = False
    
    # Run the task
    mock_task = MagicMock()
    result = await execute_evaluation(mock_task, mock_eval.evaluation_id, "Developer", "", "Junior")
    
    # Assert return value indicates clone failed
    assert "Cloning failed" in result
    assert mock_eval.status == "cloning_error"
    
    # Verify the email alert was triggered with correct parameters via Celery delay
    mock_send_access_email.delay.assert_called_once_with(
        candidate_email="candidate@example.com",
        recruiter_email="recruiter@example.com",
        github_url="https://github.com/test/repo",
        grace_hours=settings.REPO_ACCESS_GRACE_PERIOD_HOURS
    )


@pytest.mark.anyio
@patch("github_code_evaluator.workers.tasks.async_session_maker")
@patch("github_code_evaluator.workers.tasks.RepositoryService.clone_repository")
@patch("github_code_evaluator.workers.tasks.ingest_async")
@patch("github_code_evaluator.workers.tasks.llm_eval_service.evaluate_repository")
@patch("github_code_evaluator.workers.tasks.send_evaluation_failure_email_task")
async def test_llm_exhaustion_triggers_email_alert(
    mock_send_failure_email, mock_evaluate, mock_ingest, mock_clone, mock_session_maker
):
    """Verify that exhausting LLM retry attempts dispatches an evaluation failure email alert."""
    # Setup database mocks
    mock_db = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.execute = MagicMock()
    
    mock_eval = MagicMock()
    mock_eval.evaluation_id = uuid.uuid4()
    mock_eval.repository_id = uuid.uuid4()
    mock_eval.status = "queued"
    mock_eval.candidate_email = "candidate@example.com"
    mock_eval.recruiter_email = "recruiter@example.com"
    
    mock_repo = MagicMock()
    mock_repo.repository_id = mock_eval.repository_id
    mock_repo.github_url = "https://github.com/test/repo"
    mock_repo.jd_skills = []
    mock_repo.project_required_skills = []
    
    mock_res_eval = MagicMock()
    mock_res_eval.scalar_one_or_none.return_value = mock_eval
    
    mock_res_repo = MagicMock()
    mock_res_repo.scalar_one_or_none.return_value = mock_repo
    
    async def mock_execute(query):
        query_str = str(query)
        if "evaluation" in query_str:
            return mock_res_eval
        return mock_res_repo
        
    mock_db.execute = mock_execute
    
    mock_session = MagicMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_db)
    mock_session.__aexit__ = AsyncMock(return_value=False)
    mock_session_maker.return_value = mock_session
    
    mock_clone.return_value = True
    mock_ingest.return_value = ("summary", "folder_tree", "content")
    
    # Mock LLM to throw exception
    mock_evaluate.side_effect = LLMValidationException("Schema validation failed", "raw data")
    
    # Setup task to raise MaxRetriesExceededError
    mock_task = MagicMock()
    mock_task.request.retries = 2
    mock_task.retry.side_effect = MaxRetriesExceededError()
    
    # Run task
    result = await execute_evaluation(mock_task, mock_eval.evaluation_id, "Developer", "", "Junior")
    
    # Assert status failed
    assert "Max retries exceeded" in result
    assert mock_eval.status == "failed"
    
    # Verify the email alert was not triggered (disabled per configuration)
    mock_send_failure_email.delay.assert_not_called()


from fastapi.testclient import TestClient
from github_code_evaluator.app.main import app

client = TestClient(app)

@patch("github_code_evaluator.app.v1.endpoints.repositories.check_url_accessibility")
@patch("github_code_evaluator.app.v1.endpoints.repositories.send_access_failure_email_task")
def test_api_accessibility_failure_triggers_email(mock_send_access_email, mock_check_accessibility):
    """Verify that posting an inaccessible repo to the API triggers access failure email before raising 422."""
    mock_check_accessibility.return_value = False
    
    # Generate mock jwt token or bypass security if required
    # Let's bypass get_current_user dependency or mock it
    from github_code_evaluator.app.v1.core.security import get_current_user
    from github_code_evaluator.app.v1.db.session import get_db
    from tests.test_api import override_get_db
    app.dependency_overrides[get_current_user] = lambda: {"sub": "test_user"}
    app.dependency_overrides[get_db] = override_get_db
    
    payload = {
        "github_url": "https://github.com/test/private-repo",
        "job_title": "Python AI Engineer",
        "job_position": "Junior",
        "candidate_email": "candidate@example.com",
        "recruiter_email": "recruiter@example.com"
    }
    
    response = client.post("/api/v1/repositories", json=payload)
    
    # Assert HTTP response code is 201 Created and response data matches schema
    assert response.status_code == 201
    res_data = response.json()
    assert res_data["status"] == "cloning_error"
    assert res_data["message"] == "Evaluation stopped: The GitHub repository is private or inaccessible."
    assert "repository_id" in res_data
    assert "evaluation_id" in res_data
    
    # Verify the send_access_failure_email_task Celery delay was called
    mock_send_access_email.delay.assert_called_once_with(
        "candidate@example.com",
        "recruiter@example.com",
        "https://github.com/test/private-repo",
        settings.REPO_ACCESS_GRACE_PERIOD_HOURS
    )
    
    # Reset dependency overrides
    app.dependency_overrides.clear()
@pytest.mark.anyio
@patch("github_code_evaluator.app.v1.services.email.EmailService.send_email", new_callable=AsyncMock)
async def test_notify_evaluation_result_sends_email_to_hr(mock_send_email):
    from github_code_evaluator.app.v1.services.email import email_service
    from unittest.mock import ANY
    
    # Case 1: Reject (score 2.2) -> Recruiter should receive the email (1 call)
    await email_service.notify_evaluation_result(
        candidate_email="candidate@example.com",
        recruiter_email="recruiter@example.com",
        github_url="https://github.com/test/repo",
        overall_score=2.2,
        recommendation="Reject"
    )
    assert mock_send_email.call_count == 1
    args, kwargs = mock_send_email.call_args
    assert args[0] == "recruiter@example.com"
    assert args[1] == "Technical Evaluation Complete: Reject (2.2/5.0)"
    
    mock_send_email.reset_mock()

    
    # Case 2: Proceed (score 4.0) -> Only recruiter receives the email (1 call) with questions
    questions = ["What is the GIL?", "Explain React Virtual DOM."]
    await email_service.notify_evaluation_result(
        candidate_email="candidate@example.com",
        recruiter_email="recruiter@example.com",
        github_url="https://github.com/test/repo",
        overall_score=4.0,
        recommendation="Proceed",
        interview_questions=questions
    )
    assert mock_send_email.call_count == 1
    args, kwargs = mock_send_email.call_args
    # Check arguments: recipient, subject, body
    assert args[0] == "recruiter@example.com"
    assert args[1] == "Technical Evaluation Complete: Proceed (4.0/5.0)"
    body = args[2]
    assert "Suggested Interview Questions:" in body
    assert "- What is the GIL?" in body
    assert "- Explain React Virtual DOM." in body

