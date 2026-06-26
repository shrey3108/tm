"""
Candidate timeline service.

Extracted from candidate_service.py to keep file sizes manageable.
Aggregates stages, evaluations and HR decisions into a chronological
timeline for a candidate.
"""
from datetime import datetime, timezone
import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.models.candidates import Candidate
from app.v1.db.models.hr_decisions import HrDecision
from app.v1.db.models.resumes import Resume
from app.v1.db.models.resume_version_results import ResumeVersionResult
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.job_stage_configs import JobStageConfig
from app.v1.db.models.evaluations import Evaluation


class CandidateTimelineService:
    """
    Service for building a candidate's chronological timeline.
    """

    async def get_candidate_timeline(
        self, 
        db: AsyncSession, 
        candidate_id: uuid.UUID, 
        job_id: uuid.UUID | None = None,
        query: str | None = None
    ) -> dict[str, Any]:
        """
        Aggregate stages, decisions, and results into a chronological timeline.
        Consolidates redundant events and ensures logical sequencing.
        """
        # Fetch candidate for base created_at fallback
        candidate = await db.get(Candidate, candidate_id)
        if not candidate:
             raise HTTPException(status_code=404, detail="Candidate not found")
             
        created_at_fallback = candidate.created_at

        events_map = {} # Keyed by (event_type, stage_id) or unique string

        # 1. Fetch Stages
        stmt = (
            select(CandidateStage)
            .select_from(CandidateStage)
            .join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
            .where(CandidateStage.candidate_id == candidate_id)
            .options(
                selectinload(CandidateStage.job_stage).selectinload(JobStageConfig.template)
            )
        )
        if job_id:
            stmt = stmt.where(JobStageConfig.job_id == job_id)
        
        stages = (await db.execute(stmt)).scalars().all()

        # Build a map for easy lookup by JobStageConfig ID to match with Decisions
        config_to_candidate_stage_map = {s.job_stage_id: s.id for s in stages}
        
        # Track the 'first' stage (usually Resume Screening) per job for consolidation
        first_stage_per_job = {} # job_id -> event_key
        
        # 2. Fetch Resume Screening Results
        resume_stmt = (
            select(ResumeVersionResult)
            .join(Resume, ResumeVersionResult.resume_id == Resume.id)
            .where(Resume.candidate_id == candidate_id)
            .options(selectinload(ResumeVersionResult.job))
            .order_by(ResumeVersionResult.analyzed_at.desc())
        )
        if job_id:
            resume_stmt = resume_stmt.where(ResumeVersionResult.job_id == job_id)
        
        resume_results = (await db.execute(resume_stmt)).scalars().all()
        resume_by_job = {r.job_id: r for r in resume_results}

        # Helper for order
        def get_order(s):
            return s.job_stage.stage_order if s.job_stage else 0

        # 3. Map stages and their evaluations
        for stage in stages:
            # Fetch latest evaluation for this stage
            eval_stmt = select(Evaluation).where(Evaluation.candidate_stage_id == stage.id).order_by(Evaluation.created_at.desc()).limit(1)
            eval_obj = (await db.execute(eval_stmt)).scalar_one_or_none()

            title = stage.job_stage.template.name if stage.job_stage and stage.job_stage.template else "Unknown Stage"
            is_resume_screening = title == "Resume Screening" or (stage.job_stage and stage.job_stage.stage_order == 0)
            
            # Base status and results
            result = {
                "completed": "passed",
                "evaluation_completed": "completed",
                "failed": "pending",
                "skipped": "skipped",
                "active": "pending",
                "pending": "pending",
            }.get(stage.status, "pending")
            score = None
            metadata = stage.evaluation_data or {}
            
            if eval_obj:
                result = eval_obj.result or result
                score = eval_obj.overall_score
                metadata = {
                    "id": str(eval_obj.id),
                    "interview_id": str(eval_obj.interview_id) if eval_obj.interview_id else None,
                    "transcript_id": str(eval_obj.transcript_id) if eval_obj.transcript_id else None,
                    "candidate_stage_id": str(eval_obj.candidate_stage_id),
                    "version": eval_obj.attempt_number,
                    "overall_score": float(eval_obj.overall_score) if eval_obj.overall_score is not None else None,
                    "result": eval_obj.result,
                    "created_at": eval_obj.created_at.isoformat() if eval_obj.created_at else None,
                    "evaluation_data": eval_obj.structured_evaluation_data,
                    "highlights": eval_obj.highlights,
                }

            # Merge Resume Screening AI Data
            resume_analyzed_at = None
            if is_resume_screening:
                r_res = resume_by_job.get(stage.job_stage.job_id if stage.job_stage else None)
                if r_res:
                    title = "Resume Screening"
                    result = r_res.pass_fail or result
                    score = float(r_res.resume_score) if r_res.resume_score is not None else score
                    resume_analyzed_at = r_res.analyzed_at
                    if not isinstance(metadata, dict): metadata = {}
                    metadata.update({
                        "screening_id": str(r_res.id),
                        "match_percentage": r_res.resume_score,
                        "analyzed_at": r_res.analyzed_at.isoformat() if r_res.analyzed_at else None,
                        **(r_res.analysis_data or {})
                    })

            # Date Logic: Suppress for pending stages
            event_date = stage.completed_at or (eval_obj.created_at if eval_obj else None) or resume_analyzed_at
            if not event_date and stage.status not in ["pending", "active"]:
                event_date = stage.started_at
            
            event_key = f"stage_{stage.id}"
            events_map[event_key] = {
                "event_type": "stage",
                "event_date": event_date,
                "title": title,
                "description": f"AI matched resume against {stage.job_stage.job.title if stage.job_stage and stage.job_stage.job else 'Job'}" if is_resume_screening else f"Candidate was in {title}",
                "result": result,
                "ai_result": result,
                "hr_decision": "pending" if eval_obj is not None else None,
                "score": float(score) if score is not None else None,
                "ai_score": float(score) if score is not None else None,
                "hr_score": None,
                "stage_id": stage.id,
                "stage_name": title,
                "job_id": stage.job_stage.job_id if stage.job_stage else None,
                "job_stage_config_id": stage.job_stage_id if stage.job_stage_id else None,
                "stage_order": get_order(stage),
                "metadata": metadata
            }

        # 4. Handle Standalone Screenings (Fallbacks for missing stages)
        for j_id, r_res in resume_by_job.items():
            # Robust check: does this job already have a Resume Screening event?
            has_rs = any(
                str(ev.get("job_id")) == str(j_id) and 
                (ev.get("stage_order") == 0 or ev.get("title") == "Resume Screening")
                for ev in events_map.values()
            )
            if not has_rs:
                event_key = f"screening_{r_res.id}"
                events_map[event_key] = {
                    "event_type": "stage",
                    "event_date": r_res.analyzed_at,
                    "title": "Resume Screening",
                    "description": f"AI matched resume against {r_res.job.title if r_res.job else 'Job'}",
                    "result": r_res.pass_fail or "completed",
                    "ai_result": r_res.pass_fail or "completed",
                    "hr_decision": None,
                    "score": float(r_res.resume_score) if r_res.resume_score is not None else None,
                    "ai_score": float(r_res.resume_score) if r_res.resume_score is not None else None,
                    "hr_score": None,
                    "stage_id": None,
                    "stage_name": "Resume Screening",
                    "job_id": r_res.job_id,
                    "stage_order": 0,
                    "metadata": {
                        "screening_id": str(r_res.id),
                        "match_percentage": r_res.resume_score,
                        "analyzed_at": r_res.analyzed_at.isoformat() if r_res.analyzed_at else None,
                        **(r_res.analysis_data or {})
                    }
                }

        # 5. Apply HR Decisions
        decision_stmt = select(HrDecision).where(HrDecision.candidate_id == candidate_id).options(
            selectinload(HrDecision.stage_config).selectinload(JobStageConfig.template)
        )
        if job_id:
            decision_stmt = decision_stmt.where(HrDecision.job_id == job_id)
        
        decisions = (await db.execute(decision_stmt.order_by(HrDecision.decided_at.asc()))).scalars().all()
        
        for dec in decisions:
            # Match decision to the best possible event
            target_ev = None
            dec_job_id_str = str(dec.job_id)
            dec_order = dec.stage_config.stage_order if dec.stage_config else 0
            
            # Prioritize matching by stage_id if we have it in the decision
            # (Though legacy decisions might not have it)
            
            # Search for best match
            for ev in events_map.values():
                ev_job_id = ev.get("job_id")
                # Handle potential mismatch in string/UUID types and None values
                job_matches = False
                if dec.job_id and ev_job_id:
                    job_matches = str(dec.job_id).lower() == str(ev_job_id).lower()
                elif not dec.job_id:
                    # If decision has no job_id, it might be global or for the applied job
                    # Assume it matches if order is correct (fallback)
                    job_matches = True
                
                if job_matches and ev.get("stage_order") == dec_order:
                    # If we found a direct stage match, take it and stop searching
                    if ev.get("stage_id"):
                        target_ev = ev
                        break
                    # Otherwise, keep it as a potential fallback (standalone event)
                    target_ev = ev
            
            if target_ev:
                target_ev["hr_decision"] = dec.decision
                target_ev["result"] = dec.decision
                target_ev["hr_score"] = float(dec.score) if dec.score is not None else None
                if dec.notes:
                    note_text = f" HR Notes: {dec.notes}"
                    if note_text not in (target_ev["description"] or ""):
                        target_ev["description"] = (target_ev["description"] or "") + note_text
                if dec.decided_at and (target_ev["event_date"] is None or dec.decided_at > target_ev["event_date"]):
                    target_ev["event_date"] = dec.decided_at

        # 6. Finalize and Sort
        events = list(events_map.values())
        if query:
            q = query.lower()
            events = [e for e in events if q in e["title"].lower() or q in (e["description"] or "").lower()]

        def sort_key(x):
            order = x.get("stage_order", 0)
            dt = x.get("event_date")
            if dt is None:
                dt = datetime.max.replace(tzinfo=timezone.utc)
            elif dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return (order, dt)

        events.sort(key=sort_key)

        # Final Status
        latest_decision = "Pending"
        if decisions:
            latest_decision = decisions[-1].decision

        current_stage_name = "Resume Screening"
        if stages:
            active = [s for s in stages if s.status == "active"]
            if active:
                current_stage_obj = sorted(active, key=get_order)[0]
                current_stage_name = current_stage_obj.job_stage.template.name if current_stage_obj.job_stage else "Unknown"
            else:
                completed = [s for s in stages if s.status != "pending"]
                if completed:
                    current_stage_obj = sorted(completed, key=get_order)[-1]
                    current_stage_name = current_stage_obj.job_stage.template.name if current_stage_obj.job_stage else "Unknown"
                else:
                    current_stage_obj = sorted(stages, key=get_order)[0]
                    current_stage_name = current_stage_obj.job_stage.template.name if current_stage_obj.job_stage else "Unknown"

        return {
            "candidate_id": candidate_id,
            "latest_decision": latest_decision,
            "current_stage": current_stage_name,
            "events": events
        }


candidate_timeline_service = CandidateTimelineService()
