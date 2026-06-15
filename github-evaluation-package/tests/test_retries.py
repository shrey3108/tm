import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from celery.exceptions import MaxRetriesExceededError, Retry
from github_code_evaluator.app.v1.services.llm import LLMValidationException
from github_code_evaluator.workers.tasks import execute_evaluation


@pytest.mark.anyio
@patch("github_code_evaluator.workers.tasks.async_session_maker")
@patch("github_code_evaluator.workers.tasks.RepositoryService.clone_repository")
@patch("github_code_evaluator.workers.tasks.ingest_async")
@patch("github_code_evaluator.workers.tasks.llm_eval_service.evaluate_repository")
async def test_execute_evaluation_retry_on_validation_failure(
    mock_evaluate, mock_ingest, mock_clone, mock_session_maker
):
    # Setup database mocks
    mock_db = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.execute = MagicMock()
    
    mock_eval = MagicMock()
    mock_eval.evaluation_id = uuid.uuid4()
    mock_eval.repository_id = uuid.uuid4()
    mock_eval.status = "queued"
    
    mock_repo = MagicMock()
    mock_repo.repository_id = mock_eval.repository_id
    mock_repo.github_url = "https://github.com/test/repo"
    mock_repo.jd_skills = []
    mock_repo.project_required_skills = []
    
    # Mock database queries
    mock_res_eval = MagicMock()
    mock_res_eval.scalar_one_or_none.return_value = mock_eval
    
    mock_res_repo = MagicMock()
    mock_res_repo.scalar_one_or_none.return_value = mock_repo
    
    # Mock execute return values
    async def mock_execute(query):
        # Determine query type based on model classes
        query_str = str(query)
        if "evaluation" in query_str:
            return mock_res_eval
        return mock_res_repo
    
    mock_db.execute = mock_execute
    
    # Mock context manager for session maker
    mock_session = MagicMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_db)
    mock_session.__aexit__ = AsyncMock(return_value=False)
    mock_session_maker.return_value = mock_session
    
    # Mock cloning and ingestion success
    mock_clone.return_value = True
    mock_ingest.return_value = ("summary", "folder_tree", "content")
    
    # Mock evaluate_repository to raise LLMValidationException
    mock_evaluate.side_effect = LLMValidationException("Failed validation", "raw llm response")
    
    # Mock celery task self
    mock_task = MagicMock()
    mock_task.request.retries = 0
    # Simulate Celery retry raising Celery Retry exception
    mock_task.retry.side_effect = Retry()
    
    # Run and assert it calls retry
    with pytest.raises(Retry):
        await execute_evaluation(mock_task, mock_eval.evaluation_id, "Developer", "", "Junior")
        
    # Verify mock_task.retry was called
    mock_task.retry.assert_called_once()


@pytest.mark.anyio
@patch("github_code_evaluator.workers.tasks.async_session_maker")
@patch("github_code_evaluator.workers.tasks.RepositoryService.clone_repository")
@patch("github_code_evaluator.workers.tasks.ingest_async")
@patch("github_code_evaluator.workers.tasks.llm_eval_service.evaluate_repository")
async def test_execute_evaluation_failed_on_max_retries(
    mock_evaluate, mock_ingest, mock_clone, mock_session_maker
):
    # Setup database mocks
    mock_db = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.execute = MagicMock()
    
    mock_eval = MagicMock()
    mock_eval.evaluation_id = uuid.uuid4()
    mock_eval.repository_id = uuid.uuid4()
    mock_eval.status = "queued"
    
    mock_repo = MagicMock()
    mock_repo.repository_id = mock_eval.repository_id
    mock_repo.github_url = "https://github.com/test/repo"
    mock_repo.jd_skills = []
    mock_repo.project_required_skills = []
    
    # Mock database queries
    mock_res_eval = MagicMock()
    mock_res_eval.scalar_one_or_none.return_value = mock_eval
    
    mock_res_repo = MagicMock()
    mock_res_repo.scalar_one_or_none.return_value = mock_repo
    
    # Mock execute return values
    async def mock_execute(query):
        query_str = str(query)
        if "evaluation" in query_str:
            return mock_res_eval
        return mock_res_repo
    
    mock_db.execute = mock_execute
    
    # Mock context manager for session maker
    mock_session = MagicMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_db)
    mock_session.__aexit__ = AsyncMock(return_value=False)
    mock_session_maker.return_value = mock_session
    
    # Mock cloning and ingestion success
    mock_clone.return_value = True
    mock_ingest.return_value = ("summary", "folder_tree", "content")
    
    # Mock evaluate_repository to raise LLMValidationException
    mock_evaluate.side_effect = LLMValidationException("Failed validation", "raw llm response")
    
    # Mock celery task self
    mock_task = MagicMock()
    mock_task.request.retries = 2
    # Simulate Celery raising MaxRetriesExceededError when retry is called
    mock_task.retry.side_effect = MaxRetriesExceededError()
    
    # Run execute_evaluation
    result = await execute_evaluation(mock_task, mock_eval.evaluation_id, "Developer", "", "Junior")
    
    # Assert return value indicates failure
    assert "Failed: Max retries exceeded" in result
    # Assert evaluation status is updated to failed
    assert mock_eval.status == "failed"
    mock_db.commit.assert_called()
