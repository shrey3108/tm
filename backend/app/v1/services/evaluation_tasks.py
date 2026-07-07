
import uuid
import asyncio
import os
import nest_asyncio
from typing import Any, Dict
from app.v1.core.celery_app import celery_app
from app.v1.db.session import async_session_maker
from app.v1.services.evaluation_service import evaluation_service
import logging

logger = logging.getLogger(__name__)

async def run_with_cleanup(coro):
    try:
        return await coro
    finally:
        try:
            from litellm.llms.custom_httpx.async_client_cleanup import close_litellm_async_clients
            await close_litellm_async_clients()
        except Exception:
            pass
        try:
            from app.v1.core.cache import cache
            await cache.close()
        except Exception:
            pass
        try:
            from app.v1.db.session import engine
            await engine.dispose()
        except Exception:
            pass

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
                
                try:
                    from app.v1.db.models.candidate_stages import CandidateStage
                    stage = await db.get(CandidateStage, candidate_stage_id)
                    if stage:
                        stage.status = "failed"
                        eval_data = dict(stage.evaluation_data or {})
                        eval_data["error"] = str(e)
                        stage.evaluation_data = eval_data
                        await db.commit()
                except Exception as inner_e:
                    logger.error(f"Failed to update stage status to failed: {inner_e}")

                raise

    return loop.run_until_complete(run_with_cleanup(run_evaluation()))


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
        nest_asyncio.apply()

    async def run_practical_eval():
        nonlocal eval_id
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        from app.v1.db.models.candidate_stages import CandidateStage
        from app.v1.db.models.job_stage_configs import JobStageConfig
        from app.v1.db.models.evaluations import Evaluation
        from app.v1.db.models.jobs import Job

        async with async_session_maker() as db:
            # 1. Fetch CandidateStage context
            stmt = (
                select(CandidateStage)
                .options(
                    selectinload(CandidateStage.candidate),
                    selectinload(CandidateStage.job_stage).options(
                        selectinload(JobStageConfig.job).options(
                            selectinload(Job.position)
                        ),
                        selectinload(JobStageConfig.template)
                    ),
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
                    "job_position": job.position.name if (job and job.position) else None,
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
                                    "status": submit_status or "submission_error",
                                    "github_url": github_url
                                }
                            stage.status = "failed"
                            await db.commit()
                            return
                    except Exception as ex:
                        logger.error(f"Failed to submit repository to evaluator: {ex}")
                        stage.status = "failed"
                        stage.evaluation_data = {
                            "error": str(ex),
                            "status": "submission_error",
                            "github_url": github_url
                        }
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
                        elif current_status not in ("pending", "processing", "queued"):
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
                    "status": last_status,
                    "github_url": github_url
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
                        stage.evaluation_data = {
                            "error": f"Failed to fetch report: {report_res.text}",
                            "status": "report_fetch_error",
                            "github_url": github_url
                        }
                        await db.commit()
                        return
                    report = report_res.json()
                except Exception as ex:
                    logger.error(f"Exception fetching report: {ex}")
                    stage.status = "failed"
                    stage.evaluation_data = {
                        "error": f"Exception fetching report: {str(ex)}",
                        "status": "report_fetch_error",
                        "github_url": github_url
                    }
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
                "performance (JD Skills)": {
                    "score": get_scaled(jd_scores, "performance"),
                    "reasoning": get_reasoning(jd_align, "performance", "Evaluated optimization and debugging approach for JD standard skills."),
                    "confidence": 0.9,
                    "evidence": []
                },
                "performance (Task Skills)": {
                    "score": get_scaled(proj_scores, "performance"),
                    "reasoning": get_reasoning(proj_align, "performance", "Evaluated optimization and debugging approach for custom Task/Project skills."),
                    "confidence": 0.9,
                    "evidence": []
                },

                # --- Architecture ---
                "architecture (JD Skills)": {
                    "score": get_scaled(jd_scores, "architecture"),
                    "reasoning": get_reasoning(jd_align, "architecture", "Evaluated architectural choices for JD standard skills."),
                    "confidence": 0.9,
                    "evidence": []
                },
                "architecture (Task Skills)": {
                    "score": get_scaled(proj_scores, "architecture"),
                    "reasoning": get_reasoning(proj_align, "architecture", "Evaluated architectural choices for custom Task/Project skills."),
                    "confidence": 0.9,
                    "evidence": []
                },

                # --- Code Quality ---
                "code_quality (JD Skills)": {
                    "score": get_scaled(jd_scores, "code_quality"),
                    "reasoning": get_reasoning(jd_align, "code_quality", "Evaluated code formatting and quality for JD standard skills."),
                    "confidence": 0.9,
                    "evidence": []
                },
                "code_quality (Task Skills)": {
                    "score": get_scaled(proj_scores, "code_quality"),
                    "reasoning": get_reasoning(proj_align, "code_quality", "Evaluated code formatting and quality for custom Task/Project skills."),
                    "confidence": 0.9,
                    "evidence": []
                },

                # --- Correctness ---
                "correctness (JD Skills)": {
                    "score": get_scaled(jd_scores, "correctness"),
                    "reasoning": get_reasoning(jd_align, "correctness", "Evaluated specification implementation accuracy for JD standard skills."),
                    "confidence": 0.9,
                    "evidence": []
                },
                "correctness (Task Skills)": {
                    "score": get_scaled(proj_scores, "correctness"),
                    "reasoning": get_reasoning(proj_align, "correctness", "Evaluated specification implementation accuracy for custom Task/Project skills."),
                    "confidence": 0.9,
                    "evidence": []
                },

                # --- Security ---
                "security (JD Skills)": {
                    "score": get_scaled(jd_scores, "security"),
                    "reasoning": get_reasoning(jd_align, "security", "Evaluated security practices and vulnerability exposure for JD standard skills."),
                    "confidence": 0.9,
                    "evidence": []
                },
                "security (Task Skills)": {
                    "score": get_scaled(proj_scores, "security"),
                    "reasoning": get_reasoning(proj_align, "security", "Evaluated security practices and vulnerability exposure for custom Task/Project skills."),
                    "confidence": 0.9,
                    "evidence": []
                },

                # --- Documentation ---
                "documentation (JD Skills)": {
                    "score": get_scaled(jd_scores, "documentation"),
                    "reasoning": get_reasoning(jd_align, "documentation", "Evaluated code documentation, README clarity, and setup guides for JD standard skills."),
                    "confidence": 0.9,
                    "evidence": []
                },
                "documentation (Task Skills)": {
                    "score": get_scaled(proj_scores, "documentation"),
                    "reasoning": get_reasoning(proj_align, "documentation", "Evaluated code documentation, README clarity, and setup guides for custom Task/Project skills."),
                    "confidence": 0.9,
                    "evidence": []
                }
            }

            security_risks = report.get("security_risks", []) or []
            security_risks_str = "\n".join(f"- {r}" for r in security_risks) if security_risks else "No major security risks identified."

            # Prefix each strength, weakness, and followup question with [JD Alignment] or [Project Requirements]
            # to keep them clearly segregated on the UI without modifying any frontend code.
            jd_strengths = jd_align.get("strengths", []) if isinstance(jd_align, dict) else []
            if not jd_strengths:
                jd_strengths = ["No specific strengths identified."]
            proj_strengths = proj_align.get("strengths", []) if isinstance(proj_align, dict) else []
            if not proj_strengths:
                proj_strengths = ["No specific strengths identified."]
            
            combined_strengths = []
            extraordinary = []
            for s in jd_strengths:
                if isinstance(s, str) and s.strip():
                    val = s.strip()
                    combined_strengths.append(f"[JD Alignment] {val}")
                    if val != "No specific strengths identified.":
                        extraordinary.append(val)
            for s in proj_strengths:
                if isinstance(s, str) and s.strip():
                    val = s.strip()
                    combined_strengths.append(f"[Project Requirements] {val}")
                    if val != "No specific strengths identified.":
                        extraordinary.append(val)

            jd_weaknesses = jd_align.get("weaknesses", []) if isinstance(jd_align, dict) else []
            if not jd_weaknesses:
                jd_weaknesses = ["No specific weaknesses identified."]
            proj_weaknesses = proj_align.get("weaknesses", []) if isinstance(proj_align, dict) else []
            if not proj_weaknesses:
                proj_weaknesses = ["No specific weaknesses identified."]
                
            combined_weaknesses = []
            for w in jd_weaknesses:
                if isinstance(w, str) and w.strip():
                    combined_weaknesses.append(f"[JD Alignment] {w.strip()}")
            for w in proj_weaknesses:
                if isinstance(w, str) and w.strip():
                    combined_weaknesses.append(f"[Project Requirements] {w.strip()}")

            jd_followups = jd_align.get("interview_questions", []) if isinstance(jd_align, dict) else []
            if not jd_followups:
                jd_followups = ["No specific follow-up questions generated."]
            proj_followups = proj_align.get("interview_questions", []) if isinstance(proj_align, dict) else []
            if not proj_followups:
                proj_followups = ["No specific follow-up questions generated."]
                
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
            
            jd_review = str(
                report.get("jd_alignment_report") or 
                jd_align.get("jd_alignment_report") or 
                jd_align.get("alignment_review", "No JD alignment review provided.")
            ).strip()
            
            proj_review = str(
                report.get("project_alignment_report") or 
                proj_align.get("project_alignment_report") or 
                proj_align.get("alignment_review", "No project alignment review provided.")
            ).strip()

            overall_summary_text = (
                f"🎯 ALIGNMENT BREAKDOWN: "
                f"Job Description (JD): {jd_decision_emoji} ({jd_scaled}/5.0) | {jd_review} ── "
                f"Task/Project: {proj_decision_emoji} ({proj_scaled}/5.0) | {proj_review}"
            )

            highlights = {
                "Architectural Review": [
                    f"Score: {get_combined_score(jd_scores, proj_scores, 'architecture')}/5.0",
                    f"JD: {get_reasoning(jd_align, 'architecture', 'N/A')}",
                    f"Project: {get_reasoning(proj_align, 'architecture', 'N/A')}"
                ],
                "Code Quality Review": [
                    f"Score: {get_combined_score(jd_scores, proj_scores, 'code_quality')}/5.0",
                    f"JD: {get_reasoning(jd_align, 'code_quality', 'N/A')}",
                    f"Project: {get_reasoning(proj_align, 'code_quality', 'N/A')}"
                ],
                "Identified Security Risks": [
                    f"Score: {get_combined_score(jd_scores, proj_scores, 'security')}/5.0",
                    security_risks_str
                ],
                "Extraordinary Points": extraordinary if extraordinary else ["No extraordinary points identified."],
                "overall_summary": [
                    {"JD Alignment": jd_review},
                    {"Project Requirements": proj_review}
                ],
                "strengths": combined_strengths,
                "weaknesses": combined_weaknesses,
                "suggested_followups": combined_followups
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
                "github_evaluation_id": eval_id,
                "github_url": github_url
            }

            if candidate:
                candidate.github_evaluation_id = uuid.UUID(eval_id)
                db.add(candidate)

            await db.commit()

            # 8. Auto-send to assigned associates
            try:
                from app.v1.db.models.associates import Associate
                from app.v1.db.models.job_associates import job_associates
                from app.v1.db.models.candidate_test_paper import CandidateTestPaper
                from app.v1.db.models.associate_evaluations import AssociateEvaluation
                from app.v1.services.email_service import send_associate_notification_email
                
                # Fetch default test paper
                stmt_job = select(CandidateTestPaper).where(
                    CandidateTestPaper.job_id == job.id,
                    CandidateTestPaper.candidate_id.is_(None),
                )
                if stage.job_stage_id:
                    stmt_job_stage = stmt_job.where(CandidateTestPaper.job_stage_config_id == stage.job_stage_id)
                    res_job = await db.execute(stmt_job_stage)
                    test_paper = res_job.scalar_one_or_none()
                    if not test_paper:
                        stmt_job_none = stmt_job.where(CandidateTestPaper.job_stage_config_id.is_(None))
                        res_job = await db.execute(stmt_job_none)
                        test_paper = res_job.scalar_one_or_none()
                else:
                    stmt_job_none = stmt_job.where(CandidateTestPaper.job_stage_config_id.is_(None))
                    res_job = await db.execute(stmt_job_none)
                    test_paper = res_job.scalar_one_or_none()

                # Fetch assigned associates
                stmt_assoc = select(Associate).join(job_associates).where(job_associates.c.job_id == job.id)
                associates_res = await db.execute(stmt_assoc)
                assigned_associates = associates_res.scalars().all()

                if test_paper and assigned_associates:
                    for associate in assigned_associates:
                        try:
                            evaluation_record = AssociateEvaluation(
                                candidate_stage_id=stage.id,
                                associate_id=associate.id,
                                test_paper_id=test_paper.id,
                                candidate_id=candidate.id,
                                job_id=job.id,
                            )
                            db.add(evaluation_record)
                            await db.flush()
                            
                            await send_associate_notification_email(
                                associate_name=associate.name,
                                associate_email=associate.email,
                                candidate=candidate,
                                test_paper=test_paper,
                                github_url=github_url,
                                workdrive_url="",
                                review_token=evaluation_record.review_token,
                                db=db,
                                stage_job_id=job.id,
                                stage_name=stage.job_stage.template.name if stage.job_stage and stage.job_stage.template else None,
                            )
                        except Exception as email_ex:
                            logger.error(f"Failed to auto-send email to associate {associate.email}: {email_ex}")
                    await db.commit()
            except Exception as auto_ex:
                logger.error(f"Failed during auto-send to associates: {auto_ex}")

            # 9. Clear candidate cache
            try:
                from app.v1.services.admin.system_service import system_service
                await system_service.invalidate_job_cache(job.id)
            except Exception as cache_ex:
                logger.warning(f"Failed to clear job cache: {cache_ex}")

            logger.info(f"Practical round evaluation completed successfully for stage {candidate_stage_id_str}")

    async def safe_run_practical_eval():
        try:
            await run_practical_eval()
        except Exception as e:
            logger.error(f"GitHub evaluation task failed for stage {candidate_stage_id_str}: {e}")
            try:
                async with async_session_maker() as db:
                    from app.v1.db.models.candidate_stages import CandidateStage
                    stage = await db.get(CandidateStage, candidate_stage_id)
                    if stage:
                        stage.status = "failed"
                        eval_data = dict(stage.evaluation_data or {})
                        eval_data["error"] = str(e)
                        stage.evaluation_data = eval_data
                        await db.commit()
            except Exception as inner_e:
                logger.error(f"Failed to update stage status to failed in safe_run_practical_eval: {inner_e}")
            raise

    loop.run_until_complete(run_with_cleanup(safe_run_practical_eval()))

@celery_app.task(name="auto_trigger_github_evaluations_task")
def auto_trigger_github_evaluations_task():
    """
    Periodic task to check for CandidateStages that have been in 'submitted' status
    for more than 24 hours and trigger the evaluation automatically.
    """
    logger.info("Starting auto_trigger_github_evaluations_task...")
    
    import asyncio
    from datetime import datetime, timezone
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.v1.db.session import async_session_maker
    from app.v1.db.models.candidate_stages import CandidateStage
    from app.v1.db.models.job_stage_configs import JobStageConfig
    from app.v1.db.models.jobs import Job
    from app.v1.services.github_eval_service import trigger_github_evaluation

    async def run_auto_trigger():
        now = datetime.now(timezone.utc)
        triggered_count = 0
        
        try:
            from app.v1.db.session import engine
            await engine.dispose()
        except Exception:
            pass
            
        async with async_session_maker() as db:
            stmt = select(CandidateStage).options(
                selectinload(CandidateStage.candidate),
                selectinload(CandidateStage.job_stage).options(
                    selectinload(JobStageConfig.job).options(
                        selectinload(Job.skills),
                        selectinload(Job.position)
                    ),
                    selectinload(JobStageConfig.template)
                )
            ).where(CandidateStage.status == "submitted")
            
            result = await db.execute(stmt)
            stages = result.scalars().all()
            
            for stage in stages:
                eval_data = stage.evaluation_data
                if not isinstance(eval_data, dict):
                    continue
                    
                submitted_at_str = eval_data.get("submitted_at")
                github_url = eval_data.get("github_url")
                
                if not submitted_at_str or not github_url:
                    continue
                    
                try:
                    submitted_at = datetime.fromisoformat(submitted_at_str)
                    if submitted_at.tzinfo is None:
                        submitted_at = submitted_at.replace(tzinfo=timezone.utc)
                        
                    elapsed_minutes = (now - submitted_at).total_seconds() / 60.0
                    if elapsed_minutes >= (24 * 60):
                        logger.info(f"Auto-triggering GitHub evaluation for CandidateStage {stage.id}")
                        await trigger_github_evaluation(
                            db=db,
                            stage=stage,
                            github_url=github_url,
                        )
                        triggered_count += 1
                except Exception as e:
                    logger.error(f"Failed to auto-trigger evaluation for CandidateStage {stage.id}: {e}")
                    
        return triggered_count

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
    count = loop.run_until_complete(run_with_cleanup(run_auto_trigger()))
    logger.info(f"Finished auto_trigger_github_evaluations_task. Triggered {count} evaluations.")


