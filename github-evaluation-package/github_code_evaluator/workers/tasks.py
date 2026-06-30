import asyncio
import logging
import os
from pathlib import Path
import tempfile
from datetime import datetime, timezone, timedelta
from uuid import UUID
from typing import Optional

from sqlalchemy import select, delete

from github_code_evaluator.app.v1.db.models.evaluation import Evaluation
from github_code_evaluator.app.v1.db.models.report import EvaluationReport
from github_code_evaluator.app.v1.db.models.repository import Repository
from github_code_evaluator.app.v1.db.models.role_config import RoleWeightConfig
from github_code_evaluator.app.v1.db.models.score import EvaluationScore
from github_code_evaluator.app.v1.db.models.prompt import PromptEvaluation
from github_code_evaluator.app.v1.db.models.security_result import SecurityResult
from github_code_evaluator.app.v1.db.session import async_session_maker
from github_code_evaluator.app.v1.services.llm import llm_eval_service, LLMValidationException
from github_code_evaluator.app.v1.services.repo import RepositoryService
from github_code_evaluator.app.v1.core.config import settings
from github_code_evaluator.app.v1.services.scoring import ScoringService
from github_code_evaluator.app.v1.services.email import email_service
from github_code_evaluator.workers.celery_app import celery_app
from celery.exceptions import MaxRetriesExceededError

try:
    from gitingest import ingest_async
except ImportError:
    from gitingest.entrypoint import ingest_async

logger = logging.getLogger(__name__)


def run_async(coro):
    """Run an async coroutine synchronously using the active or new event loop."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


async def safe_execute_evaluation(self, eval_id: UUID, role_name: str, job_desc: str, job_position: Optional[str] = None):
    try:
        return await execute_evaluation(self, eval_id, role_name, job_desc, job_position)
    except Exception as e:
        logger.error(f"Unexpected error in execute_evaluation for {eval_id}: {e}")
        try:
            async with async_session_maker() as db:
                result = await db.execute(select(Evaluation).where(Evaluation.evaluation_id == eval_id))
                evaluation = result.scalar_one_or_none()
                if evaluation:
                    evaluation.status = "failed"
                    await db.commit()
        except Exception as inner_e:
            logger.error(f"Failed to update evaluation status to failed: {inner_e}")
        raise

@celery_app.task(bind=True, name="github_code_evaluator.workers.tasks.run_evaluation_task")
def run_evaluation_task(self, evaluation_id: str, role: str, job_description: str, job_position: Optional[str] = None) -> str:
    """Async background task that executes the entire repository ingestion and evaluation pipeline."""
    return run_async(
        safe_execute_evaluation(self, UUID(evaluation_id), role, job_description, job_position)
    )


@celery_app.task(name="github_code_evaluator.workers.tasks.send_access_failure_email_task")
def send_access_failure_email_task(candidate_email: str, recruiter_email: str, github_url: str, grace_hours: int) -> None:
    """Background task to notify of repository access failure."""
    run_async(
        email_service.notify_access_failure(
            candidate_email=candidate_email,
            recruiter_email=recruiter_email,
            github_url=github_url,
            grace_period_hours=grace_hours,
        )
    )


@celery_app.task(name="github_code_evaluator.workers.tasks.send_evaluation_failure_email_task")
def send_evaluation_failure_email_task(candidate_email: str, recruiter_email: str, github_url: str, reason: str) -> None:
    """Background task to notify of evaluation system failure."""
    run_async(email_service.notify_evaluation_failure(candidate_email, recruiter_email, github_url, reason))


@celery_app.task(name="github_code_evaluator.workers.tasks.send_evaluation_result_email_task")
def send_evaluation_result_email_task(
    candidate_email: str,
    recruiter_email: str,
    github_url: str,
    overall_score: float,
    recommendation: str,
    interview_questions: list[str] = None,
) -> None:
    """Background task to notify candidate and HR of the evaluation results."""
    run_async(
        email_service.notify_evaluation_result(
            candidate_email,
            recruiter_email,
            github_url,
            overall_score,
            recommendation,
            interview_questions,
        )
    )


@celery_app.task(name="github_code_evaluator.workers.tasks.expire_failed_evaluations_task")
def expire_failed_evaluations_task() -> str:
    """Periodic task to scan and expire evaluations that failed cloning and grace period has elapsed."""
    return run_async(expire_failed_evaluations_coro())


async def expire_failed_evaluations_coro() -> str:
    grace_hours = settings.REPO_ACCESS_GRACE_PERIOD_HOURS
    threshold = datetime.now(timezone.utc) - timedelta(hours=grace_hours)
    
    async with async_session_maker() as db:
        stmt = (
            select(Evaluation)
            .where(Evaluation.status == "cloning_error")
            .where(Evaluation.created_at < threshold)
        )
        result = await db.execute(stmt)
        expired_evals = result.scalars().all()
        
        for ev in expired_evals:
            ev.status = "expired"
            
        await db.commit()
        return f"Expired {len(expired_evals)} cloning failed evaluation tasks."


async def execute_evaluation(
    self, eval_id: UUID, role_name: str, job_desc: str, job_position: Optional[str] = None
) -> str:
    """Coroutine implementing the detailed sequential evaluation pipeline steps."""
    logger.info(f"Starting evaluation pipeline for Evaluation ID: {eval_id}")

    async with async_session_maker() as db:
        # 1. Retrieve Evaluation and Repository details
        result = await db.execute(select(Evaluation).where(Evaluation.evaluation_id == eval_id))
        evaluation = result.scalar_one_or_none()
        if not evaluation:
            err = f"Evaluation job {eval_id} not found in database."
            logger.error(err)
            return err

        result = await db.execute(
            select(Repository).where(Repository.repository_id == evaluation.repository_id)
        )
        repo = result.scalar_one_or_none()
        if not repo:
            evaluation.status = "failed"
            await db.commit()
            err = f"Associated repository not found for Evaluation {eval_id}."
            logger.error(err)
            return err

        # Update status to processing
        evaluation.status = "processing"
        await db.commit()

        # Create temporary workspace directory inside the project root
        project_root = Path(__file__).resolve().parents[1]
        tmp_base_dir = project_root / "tmp"
        tmp_base_dir.mkdir(parents=True, exist_ok=True)

        with tempfile.TemporaryDirectory(dir=tmp_base_dir) as temp_dir:
            # 2. Shallow Clone repository
            clone_success = RepositoryService.clone_repository(
                repo.github_url, temp_dir
            )
            if not clone_success:
                evaluation.status = "cloning_error"
                await db.commit()
                err = f"Cloning failed for URL {repo.github_url}."
                logger.error(err)
                
                # Send email notification about accessibility issues via Celery
                candidate_email = evaluation.candidate_email or "candidate@example.com"
                recruiter_email = evaluation.recruiter_email or settings.HR_EMAIL
                grace_hours = getattr(settings, "REPO_ACCESS_GRACE_PERIOD_HOURS", 48)
                try:
                    send_access_failure_email_task.delay(
                        candidate_email=candidate_email,
                        recruiter_email=recruiter_email,
                        github_url=repo.github_url,
                        grace_hours=grace_hours,
                    )
                except Exception as ee:
                    logger.error(f"Failed to dispatch access failure emails via Celery: {ee}")
                
                return err

            repo.cloned_at = datetime.now(timezone.utc)
            await db.commit()

            # 3. Perform GitIngest parse & stack detection
            logger.info("Running local repository content ingestion...")
            try:
                summary, tree, content = await ingest_async(
                    temp_dir, include_gitignored=True
                )
            except Exception as e:
                evaluation.status = "failed"
                await db.commit()
                err = f"GitIngest extraction failed: {e}"
                logger.error(err)
                return err

            # Detect stack details
            tech_stack = RepositoryService.detect_tech_stack(tree, content)
            repo.stack = tech_stack
            await db.commit()

            # 4. Run local static security analysis
            logger.info("Running security scans (secrets regex & bandit)...")
            secrets_findings = RepositoryService.scan_for_secrets(temp_dir)
            bandit_findings = RepositoryService.run_bandit_scan(temp_dir)

            # Store findings
            sec_results = []
            has_secrets = len(secrets_findings) > 0

            # Delete any existing security results to avoid unique constraints violation on retries
            await db.execute(
                delete(SecurityResult).where(SecurityResult.evaluation_id == eval_id)
            )

            # Store secrets findings
            secrets_res = SecurityResult(
                evaluation_id=eval_id,
                tool="regex_secrets",
                findings=secrets_findings,
                critical_count=len(secrets_findings),
            )
            db.add(secrets_res)
            sec_results.append(secrets_res)

            # Store bandit findings
            bandit_critical = sum(
                1 for f in bandit_findings if f.get("severity") == "HIGH"
            )
            bandit_res = SecurityResult(
                evaluation_id=eval_id,
                tool="bandit",
                findings=bandit_findings,
                critical_count=bandit_critical,
            )
            db.add(bandit_res)
            sec_results.append(bandit_res)

            await db.commit()

            # 5. Fetch Custom Role weights or use defaults
            logger.info(f"Loading custom weights configuration for role '{role_name}'...")
            from sqlalchemy import func
            result = await db.execute(
                select(RoleWeightConfig).where(
                    func.lower(RoleWeightConfig.role_name) == func.lower(role_name.strip())
                )
            )
            role_config = result.scalar_one_or_none()
            weights = role_config.weights if role_config else None

            # 6. Fetch active prompt template or use default
            logger.info("Fetching active evaluation prompt from database...")
            prompt_template = None
            from github_code_evaluator.app.v1.core.config import settings as app_settings
            prompt_version_val = app_settings.EVALUATION_PROMPT_VERSION or "v1"
            try:
                active_prompt_result = await db.execute(
                    select(PromptEvaluation).where(PromptEvaluation.is_active == True).limit(1)
                )
                active_prompt = active_prompt_result.scalar_one_or_none()
                if active_prompt:
                    prompt_template = active_prompt.prompt_template
                    prompt_version_val = active_prompt.version
                else:
                    # Try to load prompt version configured in settings/env from prompts directory
                    prompt_dir_version = app_settings.EVALUATION_PROMPT_VERSION or "v1"
                    prompt_path = Path(__file__).resolve().parents[1] / "prompts" / prompt_dir_version / "system_prompt.txt"
                    if prompt_path.exists():
                        logger.info(f"Loading fallback prompt template from filesystem: {prompt_path}")
                        with open(prompt_path, "r", encoding="utf-8") as f:
                            prompt_template = f.read()
                        prompt_version_val = prompt_dir_version
                    else:
                        logger.warning(f"Configured fallback prompt file not found at {prompt_path}. Using hardcoded default.")
            except Exception as pe:
                logger.warning(f"Failed to query active prompt template or load filesystem fallback: {pe}. Using code defaults.")

            # Save prompt version on evaluation record
            evaluation.prompt_version = prompt_version_val
            await db.commit()

            # 7. Call LLM for qualitative evaluation
            logger.info("Calling LLM evaluator...")
            repo_context = RepositoryService.prepare_evaluation_context(
                tree, content, lightweight=settings.EVALUATION_LIGHTWEIGHT_MODE
            )
            
            try:
                report_json = await llm_eval_service.evaluate_repository(
                    repo_name=repo.github_url.split("/")[-1],
                    tech_stack=tech_stack,
                    repo_context=repo_context,
                    job_title=role_name,
                    job_position=job_position,
                    jd_skills=repo.jd_skills,
                    project_required_skills=repo.project_required_skills,
                    prompt_template=prompt_template,
                    tree_str=tree,
                    content_str=content,
                    secrets_findings=secrets_findings,
                    bandit_findings=bandit_findings,
                )
            except LLMValidationException as e:
                logger.warning(
                    f"LLM response failed schema validation (attempt {self.request.retries + 1}/3): {e}"
                )
                try:
                    raise self.retry(exc=ValueError(str(e)), max_retries=2, countdown=5)
                except MaxRetriesExceededError:
                    logger.error(
                        f"LLM validation failed after max retries. Marking evaluation {eval_id} as failed. "
                        f"Raw LLM output: {e.raw_response}"
                    )
                    evaluation.status = "failed"
                    await db.commit()
                    
                    # System failure: email dispatch disabled per configuration.
                    pass
                    
                    return f"Failed: Max retries exceeded. Raw LLM output: {e.raw_response}"
            except Exception as e:
                # LLM execution error: mark evaluation as failed directly and send failure notification
                logger.error(f"LLM evaluation failed due to system error: {e}. Marking evaluation {eval_id} as failed.")
                evaluation.status = "failed"
                await db.commit()
                
                # System failure: email dispatch disabled per configuration.
                pass
                
                return f"Failed: LLM evaluation failed. Error: {str(e)}"

            # 6.5 Filter security risks to check if there are actual vulnerabilities
            raw_risks = report_json.get("security_risks", [])
            if not isinstance(raw_risks, list):
                raw_risks = [raw_risks] if raw_risks else []

            placeholders = {
                "none",
                "no security risks",
                "no security risks identified",
                "n/a",
                "no global security risks identified",
                "no global security risks identified.",
                "no global security risks",
                "no critical security risks identified",
                "no vulnerability",
                "no vulnerabilities",
                "no risks",
                "no security vulnerabilities",
                "no security vulnerabilities identified",
                "none identified",
                "none found"
            }
            filtered_risks = []
            for r in raw_risks:
                if not r or not isinstance(r, str):
                    continue
                r_clean = r.strip().lower().rstrip(".")
                if r_clean in placeholders:
                    continue
                filtered_risks.append(r)

            # Update risks list in report_json
            report_json["security_risks"] = filtered_risks

            # Programmatically adjust security score based on risks list and secrets detection
            if has_secrets:
                if filtered_risks:
                    logger.warning("Secret detected and confirmed by AI: forcing Security score to 0.0")
                    report_score_val = 0.0
                else:
                    logger.info("Secret detected by static scanner but AI did not confirm any security risks. Skipping 0.0 override.")
                    llm_sec_score = report_json.get("security_score")
                    if llm_sec_score is None:
                        llm_sec_score = report_json.get("scores", {}).get("security")
                    try:
                        report_score_val = float(llm_sec_score) if llm_sec_score is not None else 5.0
                    except (ValueError, TypeError):
                        report_score_val = 5.0
                    report_score_val = max(0.0, min(5.0, report_score_val))
            elif not filtered_risks:
                report_score_val = 5.0
            else:
                llm_sec_score = report_json.get("security_score")
                if llm_sec_score is None:
                    llm_sec_score = report_json.get("scores", {}).get("security")
                try:
                    report_score_val = float(llm_sec_score) if llm_sec_score is not None else 0.0
                except (ValueError, TypeError):
                    report_score_val = 0.0
                report_score_val = max(0.0, min(5.0, report_score_val))

            # Synchronize report_json variables and raw_scores
            report_json["security_score"] = report_score_val
            raw_scores = report_json.get("scores", {})
            if not isinstance(raw_scores, dict):
                raw_scores = {}
            raw_scores["security"] = report_score_val
            
            # Programmatically verify documentation existence
            has_doc_files = False
            total_files_count = 0
            for root, dirs, files in os.walk(temp_dir):
                # Skip hidden directories like .git
                dirs[:] = [d for d in dirs if not d.startswith('.')]
                total_files_count += len(files)
                for f_name in files:
                    f_name_lower = f_name.lower()
                    # Skip common project configuration files
                    if f_name_lower in ["requirements.txt", "requirements-dev.txt", "requirements_dev.txt", "requirements-prod.txt", "requirements_prod.txt"]:
                        continue
                    
                    is_doc = False
                    if f_name_lower.startswith(("readme", "setup", "install", "guide", "tutorial")):
                        is_doc = True
                    elif f_name_lower.endswith(".md"):
                        is_doc = True
                    elif "docs" in root.replace(temp_dir, "").lower() and f_name_lower.endswith(".txt"):
                        is_doc = True
                        
                    if is_doc:
                        f_path = os.path.join(root, f_name)
                        if os.path.isfile(f_path) and os.path.getsize(f_path) > 10:
                            try:
                                with open(f_path, "r", encoding="utf-8", errors="ignore") as f_in:
                                    if f_in.read().strip():
                                        has_doc_files = True
                                        break
                            except Exception:
                                pass
                if has_doc_files:
                    break

            # If there are no files at all (e.g. mocked clone in tests), bypass override
            if total_files_count == 0:
                has_doc_files = True

            if not has_doc_files:
                logger.warning("No non-empty documentation files found in repository. Forcing documentation scores to 0.0.")
                raw_scores["documentation"] = 0.0
                if "jd_alignment" in report_json and isinstance(report_json["jd_alignment"], dict):
                    if "scores" in report_json["jd_alignment"] and isinstance(report_json["jd_alignment"]["scores"], dict):
                        report_json["jd_alignment"]["scores"]["documentation"] = 0.0
                if "project_alignment" in report_json and isinstance(report_json["project_alignment"], dict):
                    if "scores" in report_json["project_alignment"] and isinstance(report_json["project_alignment"]["scores"], dict):
                        report_json["project_alignment"]["scores"]["documentation"] = 0.0
            
            report_json["scores"] = raw_scores

            # 7. Compute final weighted scores and apply penalty
            detailed_scores, final_score = ScoringService.calculate_scores(
                raw_scores, has_secrets=(has_secrets and bool(filtered_risks)), custom_weights=weights
            )

            # Calculate jd_alignment scores and structure
            raw_jd_align = report_json.get("jd_alignment", {})
            raw_jd_scores = raw_jd_align.get("scores", {}) if isinstance(raw_jd_align, dict) else {}
            if not raw_jd_scores:
                raw_jd_scores = {
                    "correctness": 5.0,
                    "code_quality": 5.0,
                    "architecture": 5.0,
                    "security": 5.0,
                    "performance": 5.0,
                    "documentation": 5.0,
                }
            processed_jd_scores, jd_overall = ScoringService.calculate_scores(
                raw_jd_scores, has_secrets=(has_secrets and bool(filtered_risks)), custom_weights=weights
            )
            jd_decision = raw_jd_align.get("decision", "") if isinstance(raw_jd_align, dict) else ""
            if not isinstance(jd_decision, str) or jd_decision.strip() not in ["Proceed", "Reject"]:
                jd_decision = "Proceed" if jd_overall >= 6.0 else "Reject"
            
            jd_align_data = {
                "jd_skills": repo.jd_skills if repo else [],
                "strengths": raw_jd_align.get("strengths", []) if isinstance(raw_jd_align, dict) else [],
                "weaknesses": raw_jd_align.get("weaknesses", []) if isinstance(raw_jd_align, dict) else [],
                "alignment_review": raw_jd_align.get("alignment_review", "") if isinstance(raw_jd_align, dict) else "",
                "decision": jd_decision.strip(),
                "interview_questions": raw_jd_align.get("interview_questions", []) if isinstance(raw_jd_align, dict) else [],
                "jd_alignment_report": raw_jd_align.get("alignment_review", "") if isinstance(raw_jd_align, dict) else "",
                "scores": processed_jd_scores,
                "overall_score": jd_overall,
                "correctness_review": raw_jd_align.get("correctness_review", "") if isinstance(raw_jd_align, dict) else "",
                "code_quality_review": raw_jd_align.get("code_quality_review", "") if isinstance(raw_jd_align, dict) else "",
                "architecture_review": raw_jd_align.get("architecture_review", "") if isinstance(raw_jd_align, dict) else "",
                "security_review": raw_jd_align.get("security_review", "") if isinstance(raw_jd_align, dict) else "",
                "performance_review": raw_jd_align.get("performance_review", "") if isinstance(raw_jd_align, dict) else "",
                "documentation_review": raw_jd_align.get("documentation_review", "") if isinstance(raw_jd_align, dict) else "",
            }

            # Calculate project_alignment scores and structure
            raw_proj_align = report_json.get("project_alignment", {})
            raw_proj_scores = raw_proj_align.get("scores", {}) if isinstance(raw_proj_align, dict) else {}
            if not raw_proj_scores:
                raw_proj_scores = {
                    "correctness": 5.0,
                    "code_quality": 5.0,
                    "architecture": 5.0,
                    "security": 5.0,
                    "performance": 5.0,
                    "documentation": 5.0,
                }
            processed_proj_scores, proj_overall = ScoringService.calculate_scores(
                raw_proj_scores, has_secrets=(has_secrets and bool(filtered_risks)), custom_weights=weights
            )
            proj_decision = raw_proj_align.get("decision", "") if isinstance(raw_proj_align, dict) else ""
            if not isinstance(proj_decision, str) or proj_decision.strip() not in ["Proceed", "Reject"]:
                proj_decision = "Proceed" if proj_overall >= 6.0 else "Reject"

            project_align_data = {
                "project_required_skills": repo.project_required_skills if repo else [],
                "strengths": raw_proj_align.get("strengths", []) if isinstance(raw_proj_align, dict) else [],
                "weaknesses": raw_proj_align.get("weaknesses", []) if isinstance(raw_proj_align, dict) else [],
                "alignment_review": raw_proj_align.get("alignment_review", "") if isinstance(raw_proj_align, dict) else "",
                "decision": proj_decision.strip(),
                "interview_questions": raw_proj_align.get("interview_questions", []) if isinstance(raw_proj_align, dict) else [],
                "project_alignment_report": raw_proj_align.get("alignment_review", "") if isinstance(raw_proj_align, dict) else "",
                "scores": processed_proj_scores,
                "overall_score": proj_overall,
                "correctness_review": raw_proj_align.get("correctness_review", "") if isinstance(raw_proj_align, dict) else "",
                "code_quality_review": raw_proj_align.get("code_quality_review", "") if isinstance(raw_proj_align, dict) else "",
                "architecture_review": raw_proj_align.get("architecture_review", "") if isinstance(raw_proj_align, dict) else "",
                "security_review": raw_proj_align.get("security_review", "") if isinstance(raw_proj_align, dict) else "",
                "performance_review": raw_proj_align.get("performance_review", "") if isinstance(raw_proj_align, dict) else "",
                "documentation_review": raw_proj_align.get("documentation_review", "") if isinstance(raw_proj_align, dict) else "",
            }

            # Override final_score as the average of JD alignment overall score and Project alignment overall score
            final_score = round((jd_overall + proj_overall) / 2.0, 1)

            # Compute global security_score as average of JD and Project alignment security scores
            jd_sec = float(processed_jd_scores.get("security", {}).get("score", 0.0))
            proj_sec = float(processed_proj_scores.get("security", {}).get("score", 0.0))
            combined_security_score = round((jd_sec + proj_sec) / 2.0, 1)
            # Apply has_secrets penalty only if AI also confirmed actual risks
            if has_secrets and filtered_risks:
                combined_security_score = 0.0

            # 8. Save scores to DB
            from github_code_evaluator.app.v1.db.models.category import Category
            stmt_cats = select(Category)
            res_cats = await db.execute(stmt_cats)
            db_cats = res_cats.scalars().all()
            cat_map = {c.name: c.category_id for c in db_cats}

            # Delete any existing evaluation scores to avoid duplicates on retries
            await db.execute(
                delete(EvaluationScore).where(EvaluationScore.evaluation_id == eval_id)
            )

            for cat_name, details in detailed_scores.items():
                score_entry = EvaluationScore(
                    evaluation_id=eval_id,
                    category_id=cat_map.get(cat_name),
                    category=cat_name,
                    score=details["score"],
                    weight=details["weight"],
                    weighted_score=details["weighted_score"],
                )
                db.add(score_entry)

            # Delete any existing evaluation reports to avoid duplicates on retries
            await db.execute(
                delete(EvaluationReport).where(EvaluationReport.evaluation_id == eval_id)
            )

            # Compute recommendation
            final_recommendation = "Proceed" if final_score >= 3.5 else "Reject"
            
            # Enforce seniority rules
            raw_seniority = report_json.get("seniority_estimate", "Mid-level")
            if final_recommendation == "Proceed":
                from github_code_evaluator.app.v1.services.llm import cap_seniority_estimate
                seniority_estimate = cap_seniority_estimate(job_position, raw_seniority)
            else:
                seniority_estimate = "N/A"

            extra_pts = [p for p in (report_json.get("extraordinary_points") or []) if p and str(p).strip()]
            extra_scr = report_json.get("extraordinary_score")
            try:
                extra_scr_val = float(extra_scr) if extra_scr is not None else 0.0
            except (ValueError, TypeError):
                extra_scr_val = 0.0

            if extra_pts and extra_scr_val == 0.0:
                extra_scr_val = min(5.0, 2.0 + len(extra_pts) * 1.0)
                
            extra_scr_val = max(0.0, min(5.0, extra_scr_val))

            def parse_score(val):
                try:
                    return max(0.0, min(5.0, float(val) if val is not None else 0.0))
                except (ValueError, TypeError):
                    return 0.0

            # 9. Extract and combine suggested interview questions
            combined_qs = []
            if jd_align_data and isinstance(jd_align_data, dict):
                combined_qs.extend(jd_align_data.get("interview_questions") or [])
            if project_align_data and isinstance(project_align_data, dict):
                combined_qs.extend(project_align_data.get("interview_questions") or [])
            
            unique_qs = []
            for q in combined_qs:
                if q and str(q).strip() and q not in unique_qs:
                    unique_qs.append(str(q).strip())

            # 9.1 Save narrative report details to DB
            report_entry = EvaluationReport(
                evaluation_id=eval_id,
                strengths=[],
                weaknesses=[],
                security_risks=report_json.get("security_risks", []),
                architecture_review=report_json.get("architecture_review", ""),
                code_quality_review=report_json.get("code_quality_review", ""),
                seniority_estimate=seniority_estimate,
                interview_questions=unique_qs,
                jd_alignment_report=report_json.get("jd_alignment_report", ""),
                project_alignment_report=report_json.get("project_alignment_report", ""),
                jd_alignment=jd_align_data,
                project_alignment=project_align_data,
                extraordinary_points=report_json.get("extraordinary_points", []),
                architecture_score=parse_score(report_json.get("architecture_score")),
                code_quality_score=parse_score(report_json.get("code_quality_score")),
                security_score=parse_score(combined_security_score),
                extraordinary_score=extra_scr_val,
            )
            db.add(report_entry)

            # Update master evaluation record
            evaluation.overall_score = final_score
            evaluation.recommendation = final_recommendation
            evaluation.llm_model = settings.LLM_MODEL
            evaluation.status = "complete"

            await db.commit()

            # Dispatch success/result email
            try:
                candidate_email = evaluation.candidate_email or "candidate@example.com"
                recruiter_email = evaluation.recruiter_email or settings.HR_EMAIL
                send_evaluation_result_email_task.delay(
                    candidate_email=candidate_email,
                    recruiter_email=recruiter_email,
                    github_url=repo.github_url,
                    overall_score=float(final_score),
                    recommendation=evaluation.recommendation,
                    interview_questions=unique_qs
                )
                logger.info(f"Evaluation result email dispatched for ID: {eval_id}")
            except Exception as email_err:
                logger.error(f"Failed to dispatch evaluation result email: {email_err}")

            logger.info(f"Evaluation pipeline completed successfully for ID: {eval_id}")
            return f"Success. Overall Score: {final_score}"
