import json
import logging
import uuid
import asyncio
import numpy as np
from typing import Any, Dict, List
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import datetime

from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.jobs import Job
from app.v1.db.models.resumes import Resume
from app.v1.db.models.transcripts import Transcript
from app.v1.db.models.evaluations import Evaluation
from app.v1.db.models.criteria import Criterion
from app.v1.db.models.interviews import Interview

from app.v1.services.evaluation.engine import evaluation_engine
from app.v1.services.evaluation.agent import evaluation_agent
from app.v1.core.config import settings
from app.v1.core.observability import get_tracer
from opentelemetry.trace import StatusCode
from openinference.semconv.trace import SpanAttributes, OpenInferenceSpanKindValues

logger = logging.getLogger(__name__)
tracer = get_tracer("hiring-platform.evaluation")


class EvaluationService:
    """
    Orchestrates the multi-phase candidate evaluation pipeline.
    """

    async def evaluate_candidate_stage(
        self, db: AsyncSession, candidate_stage_id: uuid.UUID
    ) -> Dict[str, Any]:
        """
        Runs the full hybrid evaluation pipeline.
        Traced in Phoenix as 'hiring-platform.evaluate-candidate-stage'.
        """
        with tracer.start_as_current_span("evaluate-candidate-stage") as span:
            span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, OpenInferenceSpanKindValues.CHAIN.value)
            span.set_attribute("candidate_stage_id", str(candidate_stage_id))
            span.set_attribute(SpanAttributes.INPUT_VALUE, str(candidate_stage_id))
            try:
                result = await self._run_evaluation(db, candidate_stage_id, span)
                span.set_status(StatusCode.OK)
                span.set_attribute(SpanAttributes.OUTPUT_VALUE, json.dumps(result))
                return result
            except Exception as e:
                span.set_status(StatusCode.ERROR, str(e))
                span.record_exception(e)
                span.set_attribute(SpanAttributes.OUTPUT_VALUE, f"Evaluation failed: {str(e)}")
                raise e

    async def _run_evaluation(
        self, db: AsyncSession, candidate_stage_id: uuid.UUID, span=None
    ) -> Dict[str, Any]:
        """Internal evaluation logic — called from traced wrapper above."""
        from app.v1.db.models.job_stage_configs import JobStageConfig

        # 1. FETCH CONTEXT
        stmt = (
            select(CandidateStage)
            .options(
                selectinload(CandidateStage.job_stage).selectinload(
                    JobStageConfig.job
                ).selectinload(Job.skills),
                selectinload(CandidateStage.candidate).selectinload(Candidate.resumes),
            )
            .where(CandidateStage.id == candidate_stage_id)
        )

        res = await db.execute(stmt)
        cs = res.scalar_one_or_none()
        if not cs:
            raise ValueError("CandidateStage not found")

        candidate = cs.candidate
        job = cs.job_stage.job

        # Phoenix span mein candidate/job context add karo
        if span:
            span.set_attribute("candidate_id", str(candidate.id))
            candidate_full_name = f"{candidate.first_name} {candidate.last_name}" if candidate else "unknown"
            span.set_attribute("candidate_name", candidate_full_name)
            span.set_attribute("job_id", str(job.id))
            span.set_attribute("job_title", job.title or "unknown")

        # Load Transcript
        # Load all interviews for this stage
        interview_stmt = select(Interview).where(
            Interview.candidate_id == candidate.id,
            Interview.job_id == job.id,
            Interview.stage == cs.job_stage.stage_order,
        )
        interview_res = await db.execute(interview_stmt)
        interviews = list(interview_res.scalars().all())

        if not interviews:
            logger.warning(f"No exact interviews found for Candidate {candidate.id}, Job {job.id}, Stage {cs.job_stage.stage_order}. Attempting fallback...")
            # Fallback: Just any interview for this candidate
            fallback_stmt = (
                select(Interview).where(Interview.candidate_id == candidate.id).limit(5)
            )
            fallback_res = await db.execute(fallback_stmt)
            interviews = list(fallback_res.scalars().all())
            
            if not interviews:
                logger.error(f"No interviews found for candidate {candidate.id} even in fallback.")
                raise ValueError("No interview found")
            logger.info(f"Fallback: Found {len(interviews)} interview(s)")
        else:
            logger.info(f"Primary: Found {len(interviews)} interview(s) for the current stage")

        # Load ALL transcripts for these interviews
        interview_ids = [i.id for i in interviews]
        transcript_stmt = select(Transcript).where(
            Transcript.interview_id.in_(interview_ids)
        )
        transcript_res = await db.execute(transcript_stmt)
        transcripts = list(transcript_res.scalars().all())
        
        if not transcripts:
            raise ValueError("No transcripts found for associated interviews")

        # Combine all transcript text for evaluation
        # We join them with clear separators to help the LLM distinguish sessions if needed
        combined_transcript_text = "\n\n--- Next Session ---\n\n".join(
            [t.clean_transcript_text for t in transcripts if t.clean_transcript_text]
        )
        
        if not combined_transcript_text.strip():
             raise ValueError("Transcripts exist but contain no text content")

        # Create a dummy transcript object or just use the first one as a reference for metadata
        # Most evaluation logic uses transcript.clean_transcript_text
        # We'll override the clean_transcript_text in our logic below
        main_transcript = transcripts[0]
        main_transcript.clean_transcript_text = combined_transcript_text
        transcript = main_transcript
        
        # Define interview as the primary context for the evaluation record
        interview = interviews[0]

        # 2. LOAD CONFIG (Criteria + Weights)
        # Check for per-candidate override first
        config_override = (
            cs.evaluation_data.get("config_override") if cs.evaluation_data else None
        )

        if config_override:
            active_criteria_configs = config_override.get("active_criteria", [])
            logger.info(
                f"Using custom criteria override for stage {candidate_stage_id}"
            )
        else:
            # Config structure in JSONB: {"active_criteria": [{"id": "...", "weight": 20}, ...]}
            config = cs.job_stage.config or {}
            active_criteria_configs = config.get("active_criteria", [])
            if not active_criteria_configs:
                # Fallback to evaluation_criteria key if active_criteria is empty or missing
                active_criteria_configs = config.get("evaluation_criteria", [])
            logger.info(f"Initial active_criteria_configs from stage config: {len(active_criteria_configs)}")

        if not active_criteria_configs:
            # Fallback: Load all criteria linked to the template
            from app.v1.db.models.stage_template_criteria import StageTemplateCriterion

            logger.info(f"Fallback triggered. Candidate: {candidate.id}, Job: {job.id}, Template: {cs.job_stage.template_id}")
            criteria_stmt = (
                select(Criterion, StageTemplateCriterion.default_weight)
                .join(StageTemplateCriterion)
                .where(StageTemplateCriterion.template_id == cs.job_stage.template_id)
            )
            criteria_res = await db.execute(criteria_stmt)
            rows = criteria_res.all()
            logger.info(f"Fallback: Found {len(rows)} criteria for template {cs.job_stage.template_id}")
            active_criteria_configs = [
                {"id": str(r[0].id), "weight": float(r[1]), "obj": r[0]} for r in rows
            ]
        
        # Normalize active_criteria_configs to a list of dicts to handle name strings and dicts uniformly
        normalized_configs = []
        for c in active_criteria_configs:
            if isinstance(c, str):
                normalized_configs.append({"id": c, "weight": 10.0})
            elif isinstance(c, dict):
                normalized_configs.append({
                    "id": str(c.get("id") or c.get("name") or ""),
                    "weight": float(c.get("weight", 10.0)),
                    "obj": c.get("obj")
                })
            else:
                logger.warning(f"Unexpected item in active_criteria_configs: {c}")
        active_criteria_configs = normalized_configs

        logger.info(f"Final active_criteria_configs: {[c.get('id') for c in active_criteria_configs]}")

        # 3. EMBEDDING PHASE (Signals)
        resume_obj = next(iter(candidate.resumes), None)
        resume_summary = (
            json.dumps(resume_obj.parse_summary)
            if resume_obj and resume_obj.parse_summary
            else ""
        )

        # Optimization: Pre-split transcript for both signals and evidence
        t_sentences = evaluation_engine.split_into_sentences(transcript.clean_transcript_text)
        from app.v1.core.embeddings import embedding_service
        
        # We can run transcript sentence embedding and JD/Resume embedding in parallel
        
        # Start sentence embedding
        t_vectors_task = asyncio.to_thread(embedding_service.encode_transcript_batch, t_sentences) if t_sentences else asyncio.sleep(0, [])
        
        # For signals, we need a single vector for the transcript. 
        # Instead of encoding the whole transcript again, we'll wait for sentences and mean-pool them.
        t_vectors = await t_vectors_task
        if isinstance(t_vectors, asyncio.Task): # Handle the case if it's still a task
            t_vectors = await t_vectors

        # Calculate mean vector for the transcript signal
        if t_vectors:
            mean_vec_transcript = np.mean(t_vectors, axis=0).tolist()
        else:
            mean_vec_transcript = None

        # Now get signals using the precalculated transcript vector
        signals = await evaluation_engine.get_signals(
            jd_text=job.jd_text or "",
            resume_text=resume_summary,
            transcript_text=transcript.clean_transcript_text,
            precalculated_transcript_vec=mean_vec_transcript
        )

        logger.info(f"Active criteria count: {len(active_criteria_configs)}")
        # 4. RERANKER PHASE (Evidence)
        evidence_snippets = {}
        criteria_objs = {} # Map ID string to Criterion object
        
        for c_config in active_criteria_configs:
            criterion_id = str(c_config["id"])
            criterion = c_config.get("obj")
            
            if not criterion:
                try:
                    criterion = await db.get(Criterion, uuid.UUID(criterion_id))
                except ValueError:
                    # Fallback for plain text name strings saved as IDs
                    search_term = criterion_id.lower().strip()
                    if "communication" in search_term:
                        search_term = "communication"
                    elif "tech-stack" in search_term or "tech stack" in search_term or "tech_stack" in search_term:
                        search_term = "tech stack"
                    
                    result = await db.execute(
                        select(Criterion).where(func.lower(Criterion.name) == search_term)
                    )
                    criterion = result.scalar_one_or_none()
            
            if criterion:
                criteria_objs[criterion_id] = criterion
                snippets = await evaluation_engine.extract_evidence(
                    transcript.clean_transcript_text, 
                    criterion.prompt_text,
                    precalculated_sentences=t_sentences,
                    precalculated_vectors=t_vectors
                )
                evidence_snippets[criterion.name] = snippets
            else:
                logger.warning(f"Criterion ID {criterion_id} from config not found in database.")
        
        # FINAL SAFETY: If we found 0 valid criteria from the config/override, 
        # and we haven't already tried the template fallback, try it now.
        if not criteria_objs and cs.job_stage.template_id:
            logger.info(f"No valid criteria found in config. Attempting final safety fallback to template {cs.job_stage.template_id}")
            from app.v1.db.models.stage_template_criteria import StageTemplateCriterion
            criteria_stmt = (
                select(Criterion, StageTemplateCriterion.default_weight)
                .join(StageTemplateCriterion)
                .where(StageTemplateCriterion.template_id == cs.job_stage.template_id)
            )
            criteria_res = await db.execute(criteria_stmt)
            for r in criteria_res.all():
                crit = r[0]
                criteria_objs[str(crit.id)] = crit
                snippets = await evaluation_engine.extract_evidence(
                    transcript.clean_transcript_text, crit.prompt_text
                )
                evidence_snippets[crit.name] = snippets

        logger.info(f"Evidence snippets extracted for {len(evidence_snippets)} criteria")

        # 5. SCORING PHASE (Rule-based)
        calculated_scores = {
            "communication_prelim": evaluation_engine.calculate_communication_penalty(
                transcript.clean_transcript_text
            ),
            "salary_info": evaluation_engine.extract_salary_expectation(
                transcript.clean_transcript_text
            ),
            "signals": signals,
        }

        # 6. LLM PHASE (Synthesis)
        criteria_names = [obj.name for obj in criteria_objs.values()]
        logger.info(f"Invoking LLM for synthesis. Criteria: {criteria_names}")
        
        # Build enriched JD text including skills and their normalized weightages
        from sqlalchemy import text
        job_skills_query = text("SELECT skill_id, weightage FROM job_skills WHERE job_id = :job_id")
        job_skills_res = await db.execute(job_skills_query, {"job_id": job.id})
        raw_weights = {str(row[0]): float(row[1]) for row in job_skills_res.fetchall()}
        
        total_weight = sum(raw_weights.values())
        normalized_weights = {}
        if total_weight > 0:
            for s_id, w in raw_weights.items():
                normalized_weights[s_id] = (w / total_weight) * 100
        else:
            # Fallback if no weights or total is 0
            for s_id in raw_weights.keys():
                normalized_weights[s_id] = 100.0 / len(raw_weights) if len(raw_weights) > 0 else 0.0

        skills_list = []
        for s in job.skills:
            w_pct = normalized_weights.get(str(s.id), 0.0)
            skills_list.append(f"{s.name} (Weight: {w_pct:.2f}%)")
            
        skills_str = "\n".join([f"- {s}" for s in skills_list]) if skills_list else "None listed"
        full_jd_text = f"TITLE: {job.title}\n\nDESCRIPTION:\n{job.jd_text or ''}\n\nREQUIRED SKILLS (Normalized Weightages):\n{skills_str}"

        # Option to skip resume context in LLM synthesis for testing/privacy
        resume_to_send = resume_summary
        if getattr(settings, "SKIP_RESUME_CONTEXT", False):
            logger.info("Skipping resume context in LLM synthesis as per settings.")
            resume_to_send = ""

        # DEBUG: Log the prompts to identify context leakage
        logger.info(f"--- LLM USER PROMPT START ---")
        logger.info(f"TRANSCRIPT USED: {transcript.clean_transcript_text[:1000]}...")
        logger.info(f"EVIDENCE USED: {json.dumps(evidence_snippets, indent=2)}")
        logger.info(f"--- LLM USER PROMPT END ---")

        is_panel = cs.job_stage.config.get("is_panel_interview", False) if cs.job_stage.config else False

        final_report = await evaluation_agent.synthesize_evaluation(
            transcript_text=transcript.clean_transcript_text,
            jd_text=full_jd_text,
            resume_text=resume_to_send,
            calculated_scores=calculated_scores,
            evidence_snippets=evidence_snippets,
            criteria_names=criteria_names,
            is_panel_interview=is_panel,
        )

        # 7. RESTRUCTURE AND STORE PHASE
        logger.info(f"FULL FINAL REPORT: {json.dumps(final_report)}")
        logger.info(f"Expected criteria mapping for: {criteria_names}")
        
        criteria_map = final_report.get("criteria", {})
        if not criteria_map:
            # Fallback: Maybe the LLM put them in the root?
            known_root_keys = {"overall_summary", "strengths", "weaknesses", "suggested_followups", "recommendation", "criteria"}
            criteria_map = {k: v for k, v in final_report.items() if k not in known_root_keys}
            if criteria_map:
                logger.info(f"Criteria found in root (keys: {list(criteria_map.keys())})")
        
        # Merge evidence into evaluation_data
        structured_evaluation_data = {}
        for key, details in criteria_map.items():
            # Robust matching: compare normalized versions
            criterion_name_match = None
            matched_criterion_obj = None
            normalized_key = str(key).lower().replace(" ", "").replace("_", "")
            
            for crit_id, crit_obj in criteria_objs.items():
                normalized_crit = str(crit_obj.name).lower().replace(" ", "").replace("_", "")
                if normalized_crit == normalized_key:
                    criterion_name_match = crit_obj.name
                    matched_criterion_obj = crit_obj
                    break
            
            if criterion_name_match:
                structured_evaluation_data[criterion_name_match] = {
                    "score": details.get("score", 0) if isinstance(details, dict) else 0,
                    "reasoning": details.get("reasoning", "") if isinstance(details, dict) else str(details),
                    "confidence": details.get("confidence", 0.0) if isinstance(details, dict) else 0.0,
                    "evidence": evidence_snippets.get(criterion_name_match, []),
                    "prompt_text": matched_criterion_obj.prompt_text if matched_criterion_obj else None
                }
            else:
                logger.warning(f"Could not map LLM criteria key '{key}' back to any active criteria.")

        # Ensure all expected criteria are present even if LLM skipped them
        for crit_id, crit_obj in criteria_objs.items():
            if crit_obj.name not in structured_evaluation_data:
                logger.warning(f"LLM missed expected criterion '{crit_obj.name}'. Filling with default 0.")
                structured_evaluation_data[crit_obj.name] = {
                    "score": 0,
                    "reasoning": "Criterion was skipped or not evaluated by the AI.",
                    "confidence": 0.0,
                    "evidence": evidence_snippets.get(crit_obj.name, []),
                    "prompt_text": crit_obj.prompt_text
                }

        # Calculate overall score
        criteria_scores = [v["score"] for v in structured_evaluation_data.values()]
        avg_score = sum(criteria_scores) / len(criteria_scores) if criteria_scores else 0.0

        # Prepare highlights, including any potential errors
        error_msg = final_report.get("error", "")

        if error_msg:
            # Raise an exception so the Celery task marks the stage as failed without saving an Evaluation record
            raise ValueError(f"AI Synthesis Error: {error_msg}")

        # Pass/Fail Logic
        is_passed = avg_score >= 3.5
        result_status = "pass" if is_passed else "fail"
        
        # Extract arrays with fallback if model ignored strict instructions
        strengths = final_report.get("strengths", [])
        if not strengths or len(strengths) == 0:
            strengths = ["See overall summary for details on candidate strengths."]
            
        weaknesses = final_report.get("weaknesses", [])
        if not weaknesses or len(weaknesses) == 0:
            weaknesses = ["See overall summary for details on candidate weaknesses."]
            
        suggested_followups = final_report.get("suggested_followups", [])
        if not suggested_followups or len(suggested_followups) == 0:
            suggested_followups = ["No specific follow-up questions were generated by the AI."]

        highlights = {
            "strengths": strengths,
            "weaknesses": weaknesses,
            "suggested_followups": suggested_followups,
            "overall_summary": final_report.get("overall_summary", error_msg),
            "recommendation": f"{result_status.upper()} - {final_report.get('recommendation', final_report.get('overall_summary', error_msg))}"
        }

        # Fetch current max attempt number
        attempt_stmt = select(func.max(Evaluation.attempt_number)).where(Evaluation.candidate_stage_id == candidate_stage_id)
        attempt_res = await db.execute(attempt_stmt)
        current_max_attempt = attempt_res.scalar() or 0
        new_attempt_number = current_max_attempt + 1

        # Save to DB
        ev = Evaluation(
            candidate_stage_id=candidate_stage_id,
            attempt_number=new_attempt_number,
            transcript_id=transcript.id,
            interview_id=interview.id,
            evaluation_data=structured_evaluation_data,
            overall_score=avg_score,
            passing_threshold=3.5,
            result=result_status,
            recommendation=json.dumps(highlights),
            sim_jd_resume=signals["profile_fit"],
            sim_jd_transcript=signals["tech_alignment"],
            sim_resume_transcript=signals["consistency"],
            evidence_block=evidence_snippets,
        )
        db.add(ev)

        # Update candidate stage results, and mark as completed so the frontend knows the AI evaluation is done.
        # HR decisions are handled by the separate HrDecision service.
        cs.status = "completed"
        cs.evaluation_data = {
            "signals": signals,
            "report": structured_evaluation_data,
            "highlights": highlights,
            "evidence": evidence_snippets,
            "calculated_scores": calculated_scores,
            "is_passed": is_passed,
            "threshold": 3.5,
        }
        
        if error_msg:
            cs.status = "failed"
            cs.evaluation_data["error"] = error_msg

        await db.commit()

        # Invalidate job cache immediately after evaluation is committed
        try:
            from app.v1.services.admin.system_service import system_service
            await system_service.invalidate_job_cache(cs.job_stage.job_id)
        except Exception as cache_err:
            logger.warning(f"Failed to clear job cache after transcript evaluation: {cache_err}")

        # Phoenix span mein final result record karo
        if span:
            span.set_attribute("overall_score", avg_score)
            span.set_attribute("result", result_status)
            span.set_attribute("is_passed", is_passed)
            span.set_attribute("criteria_count", len(structured_evaluation_data))
            span.set_attribute("profile_fit_signal", signals.get("profile_fit", 0))
            span.set_attribute("tech_alignment_signal", signals.get("tech_alignment", 0))

        # Construct final response object matching user format
        response_obj = {
            "id": str(ev.id),
            "interview_id": str(ev.interview_id),
            "transcript_id": str(ev.transcript_id),
            "candidate_stage_id": str(ev.candidate_stage_id),
            "version": ev.attempt_number,
            "overall_score": avg_score,
            "result": result_status,
            "evaluation_data": structured_evaluation_data,
            "sim_jd_resume": signals["profile_fit"],
            "sim_jd_transcript": signals["tech_alignment"],
            "sim_resume_transcript": signals["consistency"],
            "created_at": ev.created_at.isoformat() if ev.created_at else datetime.now().isoformat(),
            "highlights": highlights
        }
        
        return response_obj


evaluation_service = EvaluationService()
