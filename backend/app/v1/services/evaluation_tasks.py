
import uuid
import asyncio
from typing import Any, Dict
from app.v1.core.celery_app import celery_app
from app.v1.db.session import async_session_maker
from app.v1.services.evaluation_service import evaluation_service
import logging

logger = logging.getLogger(__name__)

@celery_app.task(name="evaluate_candidate_transcript_task")
def evaluate_candidate_transcript_task(candidate_stage_id_str: str):
    """
    Celery task to run the AI evaluation for a candidate's transcript.
    """
    candidate_stage_id = uuid.UUID(candidate_stage_id_str)
    
    # We need to run the async service in the synchronous Celery worker
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    if loop.is_running():
        import nest_asyncio
        nest_asyncio.apply()
    
    async def run_evaluation():
        async with async_session_maker() as db:
            from app.v1.core.cache import cache
            lock_key = f"evaluation_lock:{candidate_stage_id}"
            
            # Try to acquire a 10-second lock
            if not await cache.set_nx(lock_key, "locked", ttl=10):
                logger.info(f"Evaluation for stage {candidate_stage_id} is already in progress or recently completed. Skipping redundant task.")
                return None

            try:
                logger.info(f"Starting AI evaluation for stage {candidate_stage_id}")
                result = await evaluation_service.evaluate_candidate_stage(db, candidate_stage_id)
                logger.info(f"Evaluation completed for stage {candidate_stage_id}")
                return result
            except Exception as e:
                logger.error(f"Evaluation task failed for stage {candidate_stage_id}: {e}")
                # Release lock on failure so it can be retried
                await cache.delete(lock_key)
                raise

    return loop.run_until_complete(run_evaluation())


import httpx
import json
from sqlalchemy import func

@celery_app.task(name="evaluate_candidate_practical_task")
def evaluate_candidate_practical_task(
    candidate_stage_id_str: str,
    github_url: str,
    jd_skills: list[str],
    project_required_skills: list[str],
    recruiter_email: str | None = None,
    eval_id: str | None = None,
):
    """Celery task to run repository evaluation using the GitHub Code Evaluator microservice."""
    candidate_stage_id = uuid.UUID(candidate_stage_id_str)

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    if loop.is_running():
        import nest_asyncio
        nest_asyncio.apply()

    async def run_practical_eval():
        nonlocal eval_id
        import os
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        from app.v1.db.models.candidate_stages import CandidateStage
        from app.v1.db.models.job_stage_configs import JobStageConfig
        from app.v1.db.models.evaluations import Evaluation

        async with async_session_maker() as db:
            # 1. Fetch CandidateStage context
            stmt = (
                select(CandidateStage)
                .options(
                    selectinload(CandidateStage.candidate),
                    selectinload(CandidateStage.job_stage).selectinload(JobStageConfig.job),
                )
                .where(CandidateStage.id == candidate_stage_id)
            )
            res = await db.execute(stmt)
            stage = res.scalar_one_or_none()
            if not stage:
                logger.error(f"CandidateStage {candidate_stage_id} not found in background task.")
                return

            candidate = stage.candidate
            job = stage.job_stage.job

            # 2. Trigger microservice evaluation (skip if eval_id is already provided)
            from app.v1.core.config import settings
            evaluator_url = settings.GITHUB_EVALUATOR_URL
            current_eval_id = eval_id
            
            if not current_eval_id:
                submit_url = f"{evaluator_url.rstrip('/')}/api/v1/repositories"
                
                # Prioritize settings.DEFAULT_CANDIDATE_EMAIL from .env over candidate.email
                payload_candidate_email = settings.DEFAULT_CANDIDATE_EMAIL or (candidate.email if (candidate and candidate.email) else None)
                # Prioritize settings.DEFAULT_RECRUITER_EMAIL from .env over recruiter_email
                payload_recruiter_email = settings.DEFAULT_RECRUITER_EMAIL or recruiter_email

                payload = {
                    "github_url": github_url,
                    "job_title": job.title if job else "Software Engineer",
                    "jd_skills": jd_skills,
                    "project_required_skills": project_required_skills,
                    "repo_id": str(candidate.id) if candidate else None,
                    "candidate_email": payload_candidate_email,
                    "recruiter_email": payload_recruiter_email,
                }

                logger.info(f"Submitting repository to evaluator at {submit_url}...")
                async with httpx.AsyncClient(timeout=120.0) as client:
                    try:
                        response = await client.post(submit_url, json=payload)
                        if response.status_code not in (200, 201):
                            error_msg = "Failed to submit repository to evaluator."
                            try:
                                error_data = response.json()
                                error_msg = error_data.get("error_message") or error_data.get("detail") or error_data.get("message") or error_data.get("error") or response.text
                                eval_id = error_data.get("evaluation_id")
                            except Exception:
                                error_msg = response.text or error_msg
                                eval_id = None
                            
                            if response.status_code == 409 and eval_id:
                                logger.info(f"Repository already submitted. Re-using evaluation ID inside Celery: {eval_id}")
                                current_eval_id = eval_id
                            else:
                                logger.error(f"Evaluator API returned error status {response.status_code}: {error_msg}")
                                stage.evaluation_data = {
                                    "error": error_msg,
                                    "status": "submission_error"
                                }
                                await db.commit()
                                return
                        
                        submit_data = response.json()
                        current_eval_id = submit_data.get("evaluation_id")
                        submit_status = submit_data.get("status")
                        
                        # Check if there is an immediate cloning_error or other failure in submission response
                        if not current_eval_id or submit_status in ("cloning_error", "failed"):
                            error_msg = submit_data.get("error_message") or submit_data.get("message") or submit_data.get("detail") or "No evaluation ID returned from evaluator."
                            logger.error(f"Evaluator API returned: {error_msg}")
                            stage.evaluation_data = {
                                    "error": error_msg,
                                    "status": submit_status or "submission_error"
                                }
                            await db.commit()
                            return
                    except Exception as ex:
                        logger.error(f"Failed to submit repository to evaluator: {ex}")
                        await db.commit()
                        return

            # 3. Poll for completion
            status_url = f"{evaluator_url.rstrip('/')}/api/v1/repositories/{current_eval_id}/status"
            report_url = f"{evaluator_url.rstrip('/')}/api/v1/evaluations/{current_eval_id}/report"
            
            logger.info(f"Polling evaluator status for ID {current_eval_id}...")
            is_complete = False
            last_error_message = "Evaluation timed out or failed."
            last_status = "unknown"

            for attempt in range(60): # Max 60 * 10s = 10 minutes
                await asyncio.sleep(10)
                async with httpx.AsyncClient(timeout=120.0) as client:
                    try:
                        status_res = await client.get(status_url)
                        if status_res.status_code != 200:
                            continue
                        
                        status_data = status_res.json()
                        current_status = status_data.get("status")
                        logger.info(f"Polling attempt {attempt + 1}: status is '{current_status}'")
                        
                        if current_status == "complete":
                            is_complete = True
                            break
                        elif current_status not in ("pending", "processing"):
                            last_status = current_status
                            last_error_message = status_data.get("error_message") or f"Evaluation stopped with status: {current_status}"
                            logger.error(f"Evaluator reported task failure for evaluation {eval_id}: {last_error_message}")
                            break
                    except Exception as e:
                        logger.warning(f"Error polling status: {e}")
                        continue
            
            if not is_complete:
                logger.error(f"Evaluation timed out or failed for stage {candidate_stage_id}")
                stage.status = "failed"
                stage.evaluation_data = {
                    "error": last_error_message,
                    "status": last_status
                }
                await db.commit()
                return

            # 4. Fetch the report
            logger.info(f"Fetching report from evaluator at {report_url}...")
            async with httpx.AsyncClient(timeout=120.0) as client:
                try:
                    report_res = await client.get(report_url)
                    if report_res.status_code != 200:
                        logger.error(f"Failed to fetch report from evaluator: {report_res.text}")
                        stage.status = "failed"
                        await db.commit()
                        return
                    report = report_res.json()
                except Exception as ex:
                    logger.error(f"Exception fetching report: {ex}")
                    stage.status = "failed"
                    await db.commit()
                    return

            # 5. Map and Scale results (Already 5-point)
            raw_score = report.get("overall_score", 0.0) or 0.0
            overall_score = round(float(raw_score), 2)
            result = "pass" if overall_score >= 3.5 else "fail"

            jd_align = report.get("jd_alignment") or {}
            jd_scores = jd_align.get("scores", {}) if isinstance(jd_align, dict) else {}

            proj_align = report.get("project_alignment") or {}
            proj_scores = proj_align.get("scores", {}) if isinstance(proj_align, dict) else {}

            def get_scaled(scores_dict, cat_name):
                if not scores_dict or cat_name not in scores_dict:
                    return 2.5  # fallback neutral score
                score_obj = scores_dict.get(cat_name, {})
                val = score_obj.get("score", 5.0) if isinstance(score_obj, dict) else float(score_obj)
                return round(val, 2)

            def get_reasoning(alignment_dict, cat_name, default_msg):
                if not alignment_dict or not isinstance(alignment_dict, dict):
                    return default_msg
                
                # Check for direct review key at the root of alignment dict
                key_map = {
                    "performance": "performance_review",
                    "architecture": "architecture_review",
                    "code_quality": "code_quality_review",
                    "correctness": "correctness_review",
                    "security": "security_review",
                    "documentation": "documentation_review"
                }
                review_key = key_map.get(cat_name)
                if review_key and review_key in alignment_dict:
                    val = alignment_dict.get(review_key)
                    if val and isinstance(val, str) and val.strip():
                        return val.strip()

                # Fallback to checking the score object inside scores
                scores_dict = alignment_dict.get("scores", {}) if isinstance(alignment_dict, dict) else {}
                if scores_dict and cat_name in scores_dict:
                    score_obj = scores_dict.get(cat_name, {})
                    if isinstance(score_obj, dict) and "reasoning" in score_obj:
                        return score_obj["reasoning"]

                return default_msg

            def get_combined_score(jd_sc, proj_sc, cat_name):
                jd_val = get_scaled(jd_sc, cat_name)
                proj_val = get_scaled(proj_sc, cat_name)
                return round((jd_val + proj_val) / 2.0, 2)

            def get_combined_reasoning(jd_al, proj_al, cat_name, default_jd, default_proj):
                jd_reasoning = get_reasoning(jd_al, cat_name, default_jd)
                proj_reasoning = get_reasoning(proj_al, cat_name, default_proj)
                return f"JD: {jd_reasoning}\nProject: {proj_reasoning}"

            criteria_data = {
                # --- Performance ---
                "performance": {
                    "score": get_combined_score(jd_scores, proj_scores, "performance"),
                    "reasoning": get_combined_reasoning(
                        jd_align, proj_align, "performance",
                        "Evaluated optimization and debugging approach for JD standard skills.",
                        "Evaluated optimization and debugging approach for custom Task/Project skills."
                    ),
                    "confidence": 0.9,
                    "evidence": []
                },

                # --- Architecture ---
                "architecture": {
                    "score": get_combined_score(jd_scores, proj_scores, "architecture"),
                    "reasoning": get_combined_reasoning(
                        jd_align, proj_align, "architecture",
                        "Evaluated architectural choices for JD standard skills.",
                        "Evaluated architectural choices for custom Task/Project skills."
                    ),
                    "confidence": 0.9,
                    "evidence": []
                },

                # --- Code Quality ---
                "code_quality": {
                    "score": get_combined_score(jd_scores, proj_scores, "code_quality"),
                    "reasoning": get_combined_reasoning(
                        jd_align, proj_align, "code_quality",
                        "Evaluated code formatting and quality for JD standard skills.",
                        "Evaluated code formatting and quality for custom Task/Project skills."
                    ),
                    "confidence": 0.9,
                    "evidence": []
                },

                # --- Correctness ---
                "correctness": {
                    "score": get_combined_score(jd_scores, proj_scores, "correctness"),
                    "reasoning": get_combined_reasoning(
                        jd_align, proj_align, "correctness",
                        "Evaluated specification implementation accuracy for JD standard skills.",
                        "Evaluated specification implementation accuracy for custom Task/Project skills."
                    ),
                    "confidence": 0.9,
                    "evidence": []
                },

                # --- Security ---
                "security": {
                    "score": get_combined_score(jd_scores, proj_scores, "security"),
                    "reasoning": get_combined_reasoning(
                        jd_align, proj_align, "security",
                        "Evaluated security practices and vulnerability exposure for JD standard skills.",
                        "Evaluated security practices and vulnerability exposure for custom Task/Project skills."
                    ),
                    "confidence": 0.9,
                    "evidence": []
                },

                # --- Documentation ---
                "documentation": {
                    "score": get_combined_score(jd_scores, proj_scores, "documentation"),
                    "reasoning": get_combined_reasoning(
                        jd_align, proj_align, "documentation",
                        "Evaluated code documentation, README clarity, and setup guides for JD standard skills.",
                        "Evaluated code documentation, README clarity, and setup guides for custom Task/Project skills."
                    ),
                    "confidence": 0.9,
                    "evidence": []
                }
            }

            security_risks = report.get("security_risks", []) or []
            security_risks_str = "\n".join(f"- {r}" for r in security_risks) if security_risks else "No major security risks identified."

            # Prefix each strength, weakness, and followup question with [JD Alignment] or [Project Requirements]
            # to keep them clearly segregated on the UI without modifying any frontend code.
            jd_strengths = jd_align.get("strengths", []) if isinstance(jd_align, dict) else []
            proj_strengths = proj_align.get("strengths", []) if isinstance(proj_align, dict) else []
            combined_strengths = []
            for s in jd_strengths:
                if isinstance(s, str) and s.strip():
                    combined_strengths.append(f"[JD Alignment] {s.strip()}")
            for s in proj_strengths:
                if isinstance(s, str) and s.strip():
                    combined_strengths.append(f"[Project Requirements] {s.strip()}")

            jd_weaknesses = jd_align.get("weaknesses", []) if isinstance(jd_align, dict) else []
            proj_weaknesses = proj_align.get("weaknesses", []) if isinstance(proj_align, dict) else []
            combined_weaknesses = []
            for w in jd_weaknesses:
                if isinstance(w, str) and w.strip():
                    combined_weaknesses.append(f"[JD Alignment] {w.strip()}")
            for w in proj_weaknesses:
                if isinstance(w, str) and w.strip():
                    combined_weaknesses.append(f"[Project Requirements] {w.strip()}")

            jd_followups = jd_align.get("interview_questions", []) if isinstance(jd_align, dict) else []
            proj_followups = proj_align.get("interview_questions", []) if isinstance(proj_align, dict) else []
            combined_followups = []
            for f in jd_followups:
                if isinstance(f, str) and f.strip():
                    combined_followups.append(f"[JD Alignment] {f.strip()}")
            for f in proj_followups:
                if isinstance(f, str) and f.strip():
                    combined_followups.append(f"[Project Requirements] {f.strip()}")

            jd_raw = jd_align.get("overall_score", 0.0) or 0.0
            proj_raw = proj_align.get("overall_score", 0.0) or 0.0
            
            jd_scaled = round(float(jd_raw), 2)
            proj_scaled = round(float(proj_raw), 2)
            
            jd_decision = str(jd_align.get("decision", "N/A")).upper()
            proj_decision = str(proj_align.get("decision", "N/A")).upper()
            
            jd_decision_emoji = "❌ REJECT" if jd_decision == "REJECT" else "✅ PROCEED" if jd_decision == "PROCEED" else jd_decision
            proj_decision_emoji = "❌ REJECT" if proj_decision == "REJECT" else "✅ PROCEED" if proj_decision == "PROCEED" else proj_decision
            
            jd_review = str(jd_align.get("alignment_review", "No JD alignment review provided.")).strip()
            proj_review = str(proj_align.get("alignment_review", "No project alignment review provided.")).strip()

            overall_summary_text = (
                f"🎯 ALIGNMENT BREAKDOWN: "
                f"Job Description (JD): {jd_decision_emoji} ({jd_scaled}/5.0) | {jd_review} ── "
                f"Task/Project: {proj_decision_emoji} ({proj_scaled}/5.0) | {proj_review} ── "
                f"📐 Architecture: {str(report.get('architecture_review', 'No architectural review provided.')).strip()} ── "
                f"✨ Code Quality: {str(report.get('code_quality_review', 'No code quality review provided.')).strip()} ── "
                f"⚠️ Security Risks: {', '.join(security_risks) if security_risks else 'No major security risks identified.'}"
            )

            highlights = {
                "strengths": combined_strengths,
                "weaknesses": combined_weaknesses,
                "suggested_followups": combined_followups,
                "overall_summary": overall_summary_text,
                "recommendation": f"JD Alignment: {jd_decision} ({jd_scaled}/5.0) | Project Alignment: {proj_decision} ({proj_scaled}/5.0)"
            }

            # Fetch attempt number
            attempt_stmt = select(func.max(Evaluation.attempt_number)).where(Evaluation.candidate_stage_id == candidate_stage_id)
            attempt_res = await db.execute(attempt_stmt)
            current_max_attempt = attempt_res.scalar() or 0
            new_attempt = current_max_attempt + 1

            # 6. Save Evaluation record
            ev = Evaluation(
                candidate_stage_id=candidate_stage_id,
                attempt_number=new_attempt,
                evaluation_data=criteria_data,
                overall_score=overall_score,
                passing_threshold=3.5,
                result=result,
                recommendation=json.dumps(highlights),
                evidence_block={
                    "security_findings": report.get("security_findings", []),
                    "jd_alignment": jd_align,
                    "project_alignment": proj_align
                }
            )
            db.add(ev)

            # 7. Update CandidateStage status and Candidate mapping
            stage.status = "completed"
            stage.evaluation_data = {
                "signals": {
                    "profile_fit_jd": float(get_scaled(jd_scores, "correctness") / 5.0),
                    "tech_alignment_jd": float(get_scaled(jd_scores, "code_quality") / 5.0),
                    "consistency_jd": float(get_scaled(jd_scores, "architecture") / 5.0),
                    "profile_fit_task": float(get_scaled(proj_scores, "correctness") / 5.0),
                    "tech_alignment_task": float(get_scaled(proj_scores, "code_quality") / 5.0),
                    "consistency_task": float(get_scaled(proj_scores, "architecture") / 5.0),
                },
                "report": criteria_data,
                "highlights": highlights,
                "is_passed": result == "pass",
                "threshold": 3.5,
                "github_evaluation_id": eval_id
            }

            if candidate:
                candidate.github_evaluation_id = uuid.UUID(eval_id)
                db.add(candidate)

            await db.commit()

            # 8. Clear candidate cache
            try:
                from app.v1.core.cache import cache
                await cache.clear(pattern="candidates:*")
            except Exception as cache_ex:
                logger.warning(f"Failed to clear Redis cache: {cache_ex}")

            logger.info(f"Practical round evaluation completed successfully for stage {candidate_stage_id_str}")

    loop.run_until_complete(run_practical_eval())

