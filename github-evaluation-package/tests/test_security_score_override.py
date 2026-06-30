import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from github_code_evaluator.workers.tasks import execute_evaluation
from github_code_evaluator.app.v1.db.models.prompt import PromptEvaluation
from github_code_evaluator.app.v1.db.models.score import EvaluationScore
from github_code_evaluator.app.v1.db.models.report import EvaluationReport

@pytest.fixture
def db_setup():
    mock_db = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.execute = MagicMock()
    
    mock_eval = MagicMock()
    mock_eval.evaluation_id = uuid.uuid4()
    mock_eval.repository_id = uuid.uuid4()
    mock_eval.status = "queued"
    mock_eval.prompt_version = None
    mock_eval.candidate_email = "candidate@example.com"
    mock_eval.recruiter_email = "recruiter@example.com"
    
    mock_repo = MagicMock()
    mock_repo.repository_id = mock_eval.repository_id
    mock_repo.github_url = "https://github.com/test/repo"
    mock_repo.jd_skills = []
    mock_repo.project_required_skills = []
    mock_repo.stack = {}
    
    mock_prompt = MagicMock(spec=PromptEvaluation)
    mock_prompt.version = "v1"
    mock_prompt.prompt_template = "template"
    mock_prompt.is_active = True
    
    mock_res_eval = MagicMock()
    mock_res_eval.scalar_one_or_none.return_value = mock_eval
    
    mock_res_repo = MagicMock()
    mock_res_repo.scalar_one_or_none.return_value = mock_repo

    mock_res_prompt = MagicMock()
    mock_res_prompt.scalar_one_or_none.return_value = mock_prompt
    
    added_records = []
    def mock_add(obj):
        added_records.append(obj)
            
    mock_db.add = mock_add
    
    async def mock_execute(query):
        query_str = str(query)
        if "prompt_evaluation" in query_str:
            return mock_res_prompt
        elif "evaluation" in query_str:
            return mock_res_eval
        return mock_res_repo
    
    mock_db.execute = mock_execute
    
    return mock_db, mock_eval, mock_repo, added_records


@pytest.mark.anyio
@patch("github_code_evaluator.workers.tasks.async_session_maker")
@patch("github_code_evaluator.workers.tasks.RepositoryService.clone_repository")
@patch("github_code_evaluator.workers.tasks.ingest_async")
@patch("github_code_evaluator.workers.tasks.llm_eval_service.evaluate_repository")
@patch("github_code_evaluator.workers.tasks.RepositoryService.scan_for_secrets")
@patch("github_code_evaluator.workers.tasks.RepositoryService.run_bandit_scan")
@patch("github_code_evaluator.workers.tasks.send_evaluation_result_email_task.delay")
async def test_security_score_override_no_risks(
    mock_send_email, mock_bandit, mock_secrets, mock_evaluate, mock_ingest, mock_clone, mock_session_maker, db_setup
):
    mock_db, mock_eval, mock_repo, added_records = db_setup
    
    # Mock context manager for session maker
    mock_session = MagicMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_db)
    mock_session.__aexit__ = AsyncMock(return_value=False)
    mock_session_maker.return_value = mock_session
    
    # Mock clone and ingest
    mock_clone.return_value = True
    mock_ingest.return_value = ("summary", "folder_tree", "content")
    
    # No secrets found
    mock_secrets.return_value = []
    mock_bandit.return_value = []
    
    # Mock evaluate response with placeholder security risks
    mock_evaluate.return_value = {
        "jd_alignment": {
            "strengths": [],
            "weaknesses": [],
            "alignment_review": "",
            "interview_questions": [],
            "scores": {
                "correctness": 5.0,
                "code_quality": 5.0,
                "architecture": 5.0,
                "security": 5.0,
                "performance": 5.0,
                "documentation": 5.0,
            }
        },
        "project_alignment": {
            "strengths": [],
            "weaknesses": [],
            "alignment_review": "",
            "interview_questions": [],
            "scores": {
                "correctness": 5.0,
                "code_quality": 5.0,
                "architecture": 5.0,
                "security": 5.0,
                "performance": 5.0,
                "documentation": 5.0,
            }
        },
        "strengths": [],
        "weaknesses": [],
        "security_risks": ["No global security risks identified.", "none"],
        "architecture_review": "",
        "code_quality_review": "",
        "seniority_estimate": "Senior",
        "interview_questions": [],
        "security_score": 3.0,
        "scores": {
            "correctness": 4.0,
            "code_quality": 4.0,
            "architecture": 4.0,
            "security": 3.0,
            "performance": 4.0,
            "documentation": 4.0
        }
    }
    
    # Mock task self
    mock_task = MagicMock()
    mock_task.request.retries = 0
    
    await execute_evaluation(mock_task, mock_eval.evaluation_id, "Developer", "", "Junior")
        
    # Verify report records
    reports = [r for r in added_records if isinstance(r, EvaluationReport)]
    assert len(reports) == 1
    # Risks should be empty list since placeholders were filtered out
    assert reports[0].security_risks == []
    # Score should be 5.0 since there are no actual risks and no secrets
    assert reports[0].security_score == 5.0
    
    # Verify scores stored in EvaluationScore
    scores = [s for s in added_records if isinstance(s, EvaluationScore) and s.category == "security"]
    assert len(scores) == 1
    assert scores[0].score == 5.0


@pytest.mark.anyio
@patch("github_code_evaluator.workers.tasks.async_session_maker")
@patch("github_code_evaluator.workers.tasks.RepositoryService.clone_repository")
@patch("github_code_evaluator.workers.tasks.ingest_async")
@patch("github_code_evaluator.workers.tasks.llm_eval_service.evaluate_repository")
@patch("github_code_evaluator.workers.tasks.RepositoryService.scan_for_secrets")
@patch("github_code_evaluator.workers.tasks.RepositoryService.run_bandit_scan")
@patch("github_code_evaluator.workers.tasks.send_evaluation_result_email_task.delay")
async def test_security_score_override_with_actual_risks(
    mock_send_email, mock_bandit, mock_secrets, mock_evaluate, mock_ingest, mock_clone, mock_session_maker, db_setup
):
    mock_db, mock_eval, mock_repo, added_records = db_setup
    
    # Mock context manager for session maker
    mock_session = MagicMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_db)
    mock_session.__aexit__ = AsyncMock(return_value=False)
    mock_session_maker.return_value = mock_session
    
    # Mock clone and ingest
    mock_clone.return_value = True
    mock_ingest.return_value = ("summary", "folder_tree", "content")
    
    # No secrets found
    mock_secrets.return_value = []
    mock_bandit.return_value = []
    
    # Mock evaluate response with actual security risks
    mock_evaluate.return_value = {
        "jd_alignment": {
            "strengths": [],
            "weaknesses": [],
            "alignment_review": "",
            "interview_questions": [],
            "scores": {
                "correctness": 4.0,
                "code_quality": 4.0,
                "architecture": 4.0,
                "security": 3.0,
                "performance": 4.0,
                "documentation": 4.0,
            }
        },
        "project_alignment": {
            "strengths": [],
            "weaknesses": [],
            "alignment_review": "",
            "interview_questions": [],
            "scores": {
                "correctness": 4.0,
                "code_quality": 4.0,
                "architecture": 4.0,
                "security": 3.0,
                "performance": 4.0,
                "documentation": 4.0,
            }
        },
        "strengths": [],
        "weaknesses": [],
        "security_risks": ["Critical credentials leaked in file configuration", "none"],
        "architecture_review": "",
        "code_quality_review": "",
        "seniority_estimate": "Senior",
        "interview_questions": [],
        "security_score": 3.0,
        "scores": {
            "correctness": 4.0,
            "code_quality": 4.0,
            "architecture": 4.0,
            "security": 3.0,
            "performance": 4.0,
            "documentation": 4.0
        }
    }
    
    # Mock task self
    mock_task = MagicMock()
    mock_task.request.retries = 0
    
    await execute_evaluation(mock_task, mock_eval.evaluation_id, "Developer", "", "Junior")
        
    # Verify report records
    reports = [r for r in added_records if isinstance(r, EvaluationReport)]
    assert len(reports) == 1
    # Risky finding should remain (none should be filtered out)
    assert reports[0].security_risks == ["Critical credentials leaked in file configuration"]
    # Score should be LLM score 3.0 since there are actual risks and no secrets
    assert reports[0].security_score == 3.0
    
    # Verify scores stored in EvaluationScore
    scores = [s for s in added_records if isinstance(s, EvaluationScore) and s.category == "security"]
    assert len(scores) == 1
    assert scores[0].score == 3.0


@pytest.mark.anyio
@patch("github_code_evaluator.workers.tasks.async_session_maker")
@patch("github_code_evaluator.workers.tasks.RepositoryService.clone_repository")
@patch("github_code_evaluator.workers.tasks.ingest_async")
@patch("github_code_evaluator.workers.tasks.llm_eval_service.evaluate_repository")
@patch("github_code_evaluator.workers.tasks.RepositoryService.scan_for_secrets")
@patch("github_code_evaluator.workers.tasks.RepositoryService.run_bandit_scan")
@patch("github_code_evaluator.workers.tasks.send_evaluation_result_email_task.delay")
async def test_security_score_override_with_secrets(
    mock_send_email, mock_bandit, mock_secrets, mock_evaluate, mock_ingest, mock_clone, mock_session_maker, db_setup
):
    mock_db, mock_eval, mock_repo, added_records = db_setup
    
    # Mock context manager for session maker
    mock_session = MagicMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_db)
    mock_session.__aexit__ = AsyncMock(return_value=False)
    mock_session_maker.return_value = mock_session
    
    # Mock clone and ingest
    mock_clone.return_value = True
    mock_ingest.return_value = ("summary", "folder_tree", "content")
    
    # Secrets found!
    mock_secrets.return_value = [{"file": "config.json", "line": 5, "finding": "API Key exposed"}]
    mock_bandit.return_value = []
    
    # Mock evaluate response with no risks from LLM side
    mock_evaluate.return_value = {
        "jd_alignment": {
            "strengths": [],
            "weaknesses": [],
            "alignment_review": "",
            "interview_questions": [],
            "scores": {
                "correctness": 4.0,
                "code_quality": 4.0,
                "architecture": 4.0,
                "security": 5.0,
                "performance": 4.0,
                "documentation": 4.0,
            }
        },
        "project_alignment": {
            "strengths": [],
            "weaknesses": [],
            "alignment_review": "",
            "interview_questions": [],
            "scores": {
                "correctness": 4.0,
                "code_quality": 4.0,
                "architecture": 4.0,
                "security": 5.0,
                "performance": 4.0,
                "documentation": 4.0,
            }
        },
        "strengths": [],
        "weaknesses": [],
        "security_risks": ["Critical API Key exposed in config.json"],
        "architecture_review": "",
        "code_quality_review": "",
        "seniority_estimate": "Senior",
        "interview_questions": [],
        "security_score": 5.0,
        "scores": {
            "correctness": 4.0,
            "code_quality": 4.0,
            "architecture": 4.0,
            "security": 5.0,
            "performance": 4.0,
            "documentation": 4.0
        }
    }
    
    # Mock task self
    mock_task = MagicMock()
    mock_task.request.retries = 0
    
    await execute_evaluation(mock_task, mock_eval.evaluation_id, "Developer", "", "Junior")
        
    # Verify report records
    reports = [r for r in added_records if isinstance(r, EvaluationReport)]
    assert len(reports) == 1
    # Score should be 0.0 since secrets were detected
    assert reports[0].security_score == 0.0
    
    # Verify scores stored in EvaluationScore
    scores = [s for s in added_records if isinstance(s, EvaluationScore) and s.category == "security"]
    assert len(scores) == 1
    assert scores[0].score == 0.0


@pytest.mark.anyio
@patch("github_code_evaluator.workers.tasks.async_session_maker")
@patch("github_code_evaluator.workers.tasks.RepositoryService.clone_repository")
@patch("github_code_evaluator.workers.tasks.ingest_async")
@patch("github_code_evaluator.workers.tasks.llm_eval_service.evaluate_repository")
@patch("github_code_evaluator.workers.tasks.RepositoryService.scan_for_secrets")
@patch("github_code_evaluator.workers.tasks.RepositoryService.run_bandit_scan")
@patch("github_code_evaluator.workers.tasks.send_evaluation_result_email_task.delay")
async def test_overall_score_average(
    mock_send_email, mock_bandit, mock_secrets, mock_evaluate, mock_ingest, mock_clone, mock_session_maker, db_setup
):
    mock_db, mock_eval, mock_repo, added_records = db_setup
    
    # Mock custom db.execute to return None for role weights query
    original_execute = mock_db.execute
    async def custom_execute(query):
        query_str = str(query)
        if "role_weight_configs" in query_str:
            mock_res = MagicMock()
            mock_res.scalar_one_or_none.return_value = None
            return mock_res
        return await original_execute(query)
    mock_db.execute = custom_execute
    
    # Mock context manager for session maker
    mock_session = MagicMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_db)
    mock_session.__aexit__ = AsyncMock(return_value=False)
    mock_session_maker.return_value = mock_session
    
    # Mock clone and ingest
    mock_clone.return_value = True
    mock_ingest.return_value = ("summary", "folder_tree", "content")
    
    mock_secrets.return_value = []
    mock_bandit.return_value = []
    
    # Mock evaluate response with specific alignment scores
    # default weights correctness: 0.5, performance: 0.2, documentation: 0.3
    mock_evaluate.return_value = {
        "jd_alignment": {
            "strengths": [],
            "weaknesses": [],
            "alignment_review": "",
            "interview_questions": [],
            "decision": "Proceed",
            "scores": {
                "correctness": 4.0, # weighted: 2.0
                "code_quality": 1.0,
                "architecture": 1.0,
                "security": 1.0,
                "performance": 4.0, # weighted: 0.8
                "documentation": 4.0 # weighted: 1.2
            } # jd_overall = 2.0 + 0.8 + 1.2 = 4.0
        },
        "project_alignment": {
            "strengths": [],
            "weaknesses": [],
            "alignment_review": "",
            "interview_questions": [],
            "decision": "Proceed",
            "scores": {
                "correctness": 3.0, # weighted: 1.5
                "code_quality": 1.0,
                "architecture": 1.0,
                "security": 1.0,
                "performance": 3.0, # weighted: 0.6
                "documentation": 3.0 # weighted: 0.9
            } # proj_overall = 1.5 + 0.6 + 0.9 = 3.0
        },
        "security_risks": [],
        "architecture_review": "",
        "code_quality_review": "",
        "seniority_estimate": "Senior",
        "interview_questions": [],
        "security_score": 5.0,
        "scores": {
            "correctness": 5.0,
            "code_quality": 5.0,
            "architecture": 5.0,
            "security": 5.0,
            "performance": 5.0,
            "documentation": 5.0
        }
    }
    
    # Mock task self
    mock_task = MagicMock()
    mock_task.request.retries = 0
    
    await execute_evaluation(mock_task, mock_eval.evaluation_id, "Developer", "", "Junior")
        
    # Verify overall score on the evaluation record is the average (4.0 + 3.0) / 2.0 = 3.5
    assert mock_eval.overall_score == 3.5

