import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from celery.exceptions import Retry
from github_code_evaluator.app.v1.services.llm import llm_eval_service
from github_code_evaluator.app.v1.db.models.prompt import PromptEvaluation
from github_code_evaluator.workers.tasks import execute_evaluation

def test_build_prompt_with_custom_template():
    """Verify that build_prompt replaces placeholders correctly in a custom template."""
    custom_template = "Job: {job_title}, Skills: {jd_skills_str}, Repo: {repo_name}"
    prompt = llm_eval_service.build_prompt(
        repo_name="test-repo",
        tech_stack={"languages": ["Python"]},
        repo_context="some code context",
        job_title="AI Engineer",
        job_position="Senior",
        jd_skills=["Python", "FastAPI"],
        project_required_skills=["Docker"],
        prompt_template=custom_template
    )
    
    assert prompt == "Job: AI Engineer, Skills: Python, FastAPI, Repo: test-repo"


@pytest.mark.anyio
@patch("github_code_evaluator.workers.tasks.async_session_maker")
@patch("github_code_evaluator.workers.tasks.RepositoryService.clone_repository")
@patch("github_code_evaluator.workers.tasks.ingest_async")
@patch("github_code_evaluator.workers.tasks.llm_eval_service.evaluate_repository")
async def test_execute_evaluation_with_custom_prompt_version(
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
    mock_eval.prompt_version = None
    
    mock_repo = MagicMock()
    mock_repo.repository_id = mock_eval.repository_id
    mock_repo.github_url = "https://github.com/test/repo"
    mock_repo.jd_skills = []
    mock_repo.project_required_skills = []
    
    mock_prompt = MagicMock(spec=PromptEvaluation)
    mock_prompt.version = "v2.0.0"
    mock_prompt.prompt_template = "Custom instructions for {job_title}"
    mock_prompt.is_active = True
    
    # Mock database queries
    mock_res_eval = MagicMock()
    mock_res_eval.scalar_one_or_none.return_value = mock_eval
    
    mock_res_repo = MagicMock()
    mock_res_repo.scalar_one_or_none.return_value = mock_repo

    mock_res_prompt = MagicMock()
    mock_res_prompt.scalar_one_or_none.return_value = mock_prompt
    
    # Mock execute return values
    async def mock_execute(query):
        query_str = str(query)
        if "prompt_evaluation" in query_str:
            return mock_res_prompt
        elif "evaluation" in query_str:
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
    
    # Mock evaluate_repository success
    mock_evaluate.return_value = {
        "jd_evaluation": {
            "alignment_review": "Excellent",
            "scores": {
                "correctness": {"score": 8.0, "weight": 0.30, "weighted_score": 2.4},
                "code_quality": {"score": 7.0, "weight": 0.25, "weighted_score": 1.75},
                "architecture": {"score": 7.0, "weight": 0.20, "weighted_score": 1.4},
                "security": {"score": 8.0, "weight": 0.10, "weighted_score": 0.8},
                "performance": {"score": 8.0, "weight": 0.10, "weighted_score": 0.8},
                "documentation": {"score": 8.0, "weight": 0.05, "weighted_score": 0.4}
            }
        },
        "project_evaluation": {
            "alignment_review": "Good",
            "scores": {
                "correctness": {"score": 8.0, "weight": 0.30, "weighted_score": 2.4},
                "code_quality": {"score": 7.0, "weight": 0.25, "weighted_score": 1.75},
                "architecture": {"score": 7.0, "weight": 0.20, "weighted_score": 1.4},
                "security": {"score": 8.0, "weight": 0.10, "weighted_score": 0.8},
                "performance": {"score": 8.0, "weight": 0.10, "weighted_score": 0.8},
                "documentation": {"score": 8.0, "weight": 0.05, "weighted_score": 0.4}
            }
        },
        "strengths": ["Clean code"],
        "weaknesses": ["None"],
        "security_risks": [],
        "architecture_review": "Good",
        "code_quality_review": "Good",
        "seniority_estimate": "Senior",
        "interview_questions": ["Tell me about your code"]
    }
    
    # Mock celery task self
    mock_task = MagicMock()
    mock_task.request.retries = 0
    
    # Run execute_evaluation
    result = await execute_evaluation(mock_task, mock_eval.evaluation_id, "Developer", "", "Junior")
    
    # Verify evaluation prompt version was set to v2.0.0
    assert mock_eval.prompt_version == "v2.0.0"
    # Verify evaluate_repository was called with the custom prompt template
    mock_evaluate.assert_called_once_with(
        repo_name="repo",
        tech_stack={
            'Languages': [],
            'Frameworks & Libraries': [],
            'Databases & Vector DBs': [],
            'DevOps & Containers': [],
            'Testing Frameworks': []
        },
        repo_context="DIRECTORY TREE:\nfolder_tree\n",
        job_title="Developer",
        job_position="Junior",
        jd_skills=[],
        project_required_skills=[],
        prompt_template="Custom instructions for {job_title}",
        tree_str="folder_tree",
        content_str="content",
        secrets_findings=[],
        bandit_findings=[]
    )



@pytest.mark.anyio
@patch("github_code_evaluator.workers.tasks.async_session_maker")
@patch("github_code_evaluator.workers.tasks.RepositoryService.clone_repository")
@patch("github_code_evaluator.workers.tasks.ingest_async")
@patch("github_code_evaluator.workers.tasks.llm_eval_service.evaluate_repository")
async def test_execute_evaluation_with_env_prompt_version(
    mock_evaluate, mock_ingest, mock_clone, mock_session_maker
):
    """Verify that when no active database prompt exists, the system falls back to loading the template from prompts/{EVALUATION_PROMPT_VERSION}/system_prompt.txt."""
    # Setup database mocks
    mock_db = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.execute = MagicMock()
    
    mock_eval = MagicMock()
    mock_eval.evaluation_id = uuid.uuid4()
    mock_eval.repository_id = uuid.uuid4()
    mock_eval.status = "queued"
    mock_eval.prompt_version = None
    
    mock_repo = MagicMock()
    mock_repo.repository_id = mock_eval.repository_id
    mock_repo.github_url = "https://github.com/test/repo"
    mock_repo.jd_skills = []
    mock_repo.project_required_skills = []
    
    # Mock no active prompt in DB
    mock_res_eval = MagicMock()
    mock_res_eval.scalar_one_or_none.return_value = mock_eval
    
    mock_res_repo = MagicMock()
    mock_res_repo.scalar_one_or_none.return_value = mock_repo

    mock_res_prompt = MagicMock()
    mock_res_prompt.scalar_one_or_none.return_value = None  # No prompt in DB
    
    async def mock_execute(query):
        query_str = str(query)
        if "prompt_evaluation" in query_str:
            return mock_res_prompt
        elif "evaluation" in query_str:
            return mock_res_eval
        return mock_res_repo
    
    mock_db.execute = mock_execute
    
    mock_session = MagicMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_db)
    mock_session.__aexit__ = AsyncMock(return_value=False)
    mock_session_maker.return_value = mock_session
    
    mock_clone.return_value = True
    mock_ingest.return_value = ("summary", "folder_tree", "content")
    
    mock_evaluate.return_value = {
        "jd_evaluation": {
            "alignment_review": "Excellent",
            "scores": {
                "correctness": {"score": 8.0, "weight": 0.30, "weighted_score": 2.4},
                "code_quality": {"score": 7.0, "weight": 0.25, "weighted_score": 1.75},
                "architecture": {"score": 7.0, "weight": 0.20, "weighted_score": 1.4},
                "security": {"score": 8.0, "weight": 0.10, "weighted_score": 0.8},
                "performance": {"score": 8.0, "weight": 0.10, "weighted_score": 0.8},
                "documentation": {"score": 8.0, "weight": 0.05, "weighted_score": 0.4}
            }
        },
        "project_evaluation": {
            "alignment_review": "Good",
            "scores": {
                "correctness": {"score": 8.0, "weight": 0.30, "weighted_score": 2.4},
                "code_quality": {"score": 7.0, "weight": 0.25, "weighted_score": 1.75},
                "architecture": {"score": 7.0, "weight": 0.20, "weighted_score": 1.4},
                "security": {"score": 8.0, "weight": 0.10, "weighted_score": 0.8},
                "performance": {"score": 8.0, "weight": 0.10, "weighted_score": 0.8},
                "documentation": {"score": 8.0, "weight": 0.05, "weighted_score": 0.4}
            }
        },
        "strengths": ["Clean code"],
        "weaknesses": ["None"],
        "security_risks": [],
        "architecture_review": "Good",
        "code_quality_review": "Good",
        "seniority_estimate": "Senior",
        "interview_questions": ["Tell me about your code"]
    }
    
    mock_task = MagicMock()
    mock_task.request.retries = 0
    
    # Temporarily override settings
    from github_code_evaluator.app.v1.core.config import settings as app_settings
    original_version = app_settings.EVALUATION_PROMPT_VERSION
    app_settings.EVALUATION_PROMPT_VERSION = "v2"
    
    try:
        result = await execute_evaluation(mock_task, mock_eval.evaluation_id, "Developer", "", "Junior")
        
        # Verify prompt version was set to v2 based on app_settings
        assert mock_eval.prompt_version == "v2"
        # Verify evaluate_repository was called, and prompt template was loaded
        assert mock_evaluate.call_count == 1
        called_args, called_kwargs = mock_evaluate.call_args
        assert "prompt_template" in called_kwargs
        assert "algorithm" in called_kwargs["prompt_template"].lower() or "complexity" in called_kwargs["prompt_template"].lower()
    finally:
        app_settings.EVALUATION_PROMPT_VERSION = original_version

