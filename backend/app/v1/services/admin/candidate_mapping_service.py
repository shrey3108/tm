"""
Candidate mapping helper.

Extracted from candidate_service.py to keep file sizes manageable.
Maps a Candidate ORM object to the CandidateResponse schema, including
resume analysis, HR decisions, stage pipeline, location and social links.
"""
from datetime import datetime, timezone
import uuid
import re

from app.v1.db.models.candidates import Candidate
from app.v1.db.models.resumes import Resume
from app.v1.db.models.resume_version_results import ResumeVersionResult
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.job_stage_configs import JobStageConfig
from app.v1.schemas.upload import CandidateResponse, ResumeMatchAnalysis
from app.v1.schemas.candidate_stage import CandidateStageSummary


def map_candidate_to_response(
    candidate: Candidate,
    target_job_id: uuid.UUID | None = None,
    focus_stage_id: uuid.UUID | None = None,
) -> CandidateResponse:
    """Helper to map Candidate model to CandidateResponse schema."""
    resumes = getattr(candidate, "resumes", [])
    latest_resume = (
        max(resumes, key=lambda resume: resume.uploaded_at) if resumes else None
    )

    analysis = None
    is_parsed = True
    resume_score = None
    pass_fail = None
    processing_status = None
    processing_error = None
    location = candidate.location_name
    linkedin_url = None
    github_url = None

    search_sources = []
    if candidate.info and isinstance(candidate.info, dict):
        search_sources.append(candidate.info)

    if latest_resume:
        if latest_resume.parse_summary:
            search_sources.append(latest_resume.parse_summary)
            if "extracted_data" in latest_resume.parse_summary:
                search_sources.append(latest_resume.parse_summary["extracted_data"])

        for source in search_sources:
            if not isinstance(source, dict):
                continue

            if not location:
                loc_val = source.get("location")
                if isinstance(loc_val, str) and loc_val.strip().lower() not in (
                    "not mentioned",
                    "null",
                    "none",
                ):
                    location = loc_val.strip()
                elif isinstance(loc_val, list) and loc_val:
                    for entry in loc_val:
                        loc_text = ""
                        if isinstance(entry, dict):
                            loc_text = (
                                entry.get("text") or entry.get("location") or ""
                            )
                        else:
                            loc_text = str(entry)

                        if loc_text and loc_text.strip().lower() not in (
                            "not mentioned",
                            "null",
                            "none",
                        ):
                            location = loc_text.strip()
                            break

            links = source.get("links") or source.get("social_links")
            if links:
                if isinstance(links, str):
                    link_list = [
                        link.strip() for link in re.split(r"[;,]", links) if link.strip()
                    ]
                elif isinstance(links, list):
                    link_list = links
                else:
                    link_list = []

                for link_item in link_list:
                    url = ""
                    if isinstance(link_item, dict):
                        url = link_item.get("url") or link_item.get("text") or ""
                    elif isinstance(link_item, str):
                        url = link_item

                    if not url or not isinstance(url, str):
                        continue

                    url_lower = url.lower()
                    if "linkedin.com" in url_lower and not linkedin_url:
                        linkedin_url = url
                    elif "github.com" in url_lower and not github_url:
                        github_url = url

        is_parsed = bool(latest_resume.parsed)
        resume_score = latest_resume.resume_score
        pass_fail = latest_resume.pass_fail
        parse_summary = latest_resume.parse_summary or {}

        processing_info = parse_summary.get("processing", {})
        if isinstance(processing_info, dict):
            processing_status = processing_info.get("status")
            processing_error = processing_info.get("error")

        analysis_payload = parse_summary.get("analysis")
        if isinstance(analysis_payload, dict):
            analysis = ResumeMatchAnalysis.model_validate(analysis_payload)

    # Get latest HR decision
    hr_decisions = getattr(candidate, "hr_decisions", [])
    if not hr_decisions:
         hr_decisions = []

    if target_job_id:
        target_job_str = str(target_job_id).lower()
        filtered_decisions = []
        for d in hr_decisions:
            d_job_id = getattr(d, "job_id", None)
            if d_job_id:
                if str(d_job_id).lower() == target_job_str:
                    filtered_decisions.append(d)
            else:
                if str(candidate.applied_job_id).lower() == target_job_str:
                    filtered_decisions.append(d)
                elif target_job_id:
                    filtered_decisions.append(d)
        hr_decisions = filtered_decisions

    if focus_stage_id:
        focus_list = []
        if isinstance(focus_stage_id, (list, tuple, set)):
            focus_list = [str(item) for item in focus_stage_id]
        elif isinstance(focus_stage_id, str):
            focus_list = [focus_stage_id]
        
        focus_ids = set()
        focus_names = set()
        for fs in focus_list:
            try:
                focus_ids.add(str(uuid.UUID(fs)).lower())
            except ValueError:
                focus_names.add(fs.lower())

        stage_filtered_decisions = []
        for d in hr_decisions:
            d_stage_config_id = getattr(d, "stage_config_id", None)
            if d_stage_config_id and str(d_stage_config_id).lower() in focus_ids:
                stage_filtered_decisions.append(d)
            else:
                d_stage_name = getattr(d, "stage_name", "")
                if d_stage_name and d_stage_name.lower() in focus_names:
                    stage_filtered_decisions.append(d)
                elif not d_stage_config_id and "resume screening" in focus_names:
                    stage_filtered_decisions.append(d)
        
        hr_decisions = stage_filtered_decisions
    latest_decision = None
    if hr_decisions:
        latest_decision = max(hr_decisions, key=lambda d: d.decided_at if d.decided_at else datetime.min.replace(tzinfo=timezone.utc))

    # Normalize decision string for frontend
    status = "Pending"
    hr_score_val = None
    if latest_decision:
        hr_score_val = float(latest_decision.score) if latest_decision.score is not None else None
        raw_status = str(latest_decision.decision).lower().strip()
        if raw_status in ["pass", "approve"]:
            status = "Pass"
        elif raw_status in ["fail", "reject"]:
            status = "Fail"
        elif raw_status in ["may be", "maybe"]:
            status = "May Be"
        else:
            status = latest_decision.decision

    # Get version history
    version_results = None
    if latest_resume and hasattr(latest_resume, "version_results") and latest_resume.version_results:
        version_results = [
            {
                "id": str(vr.id),
                "resume_id": str(vr.resume_id),
                "job_id": str(vr.job_id),
                "job_name": vr.job.title if vr.job else None,
                "job_version_number": vr.job_version_number,
                "resume_score": float(vr.resume_score) if vr.resume_score is not None else None,
                "pass_fail": vr.pass_fail,
                "analysis_data": vr.analysis_data,
                "analyzed_at": vr.analyzed_at.isoformat() if vr.analyzed_at else None,
            }
            for vr in latest_resume.version_results
        ]
    
    # Get pipeline and current stage
    candidate_stages = getattr(candidate, "stages", [])
    if not candidate_stages:
        candidate_stages = []
    
    # Filter by target_job_id if provided
    effective_filter_job_id = target_job_id or candidate.applied_job_id
    if effective_filter_job_id:
        eff_job_str = str(effective_filter_job_id).lower()
        candidate_stages = [
            cs for cs in candidate_stages 
            if cs.job_stage and str(cs.job_stage.job_id).lower() == eff_job_str
        ]

    # Create a lookup for decisions by stage_config_id
    decisions_by_stage = {}
    for d in hr_decisions:
        # Map by stage_config_id if present
        if d.stage_config_id:
            if d.stage_config_id not in decisions_by_stage or (
                d.decided_at > decisions_by_stage[d.stage_config_id].decided_at
            ):
                decisions_by_stage[d.stage_config_id] = d
        else:
            # If no stage_config_id, it's a "Resume Screening" decision.
            # Map it to the stage with order 1 if it exists.
            for cs in candidate_stages:
                if cs.job_stage and cs.job_stage.stage_order == 1:
                    if cs.job_stage_id not in decisions_by_stage or (
                        d.decided_at > decisions_by_stage[cs.job_stage_id].decided_at
                    ):
                        decisions_by_stage[cs.job_stage_id] = d
                    break
    
    def _map_stage(cs) -> CandidateStageSummary:
        is_finished = cs.status in ["completed", "failed", "skipped"]
        response_status = "completed" if is_finished else cs.status
        
        # Default result based on status (this is the AI result if status is set by AI)
        ai_result_val = {
            "completed": "passed",
            "failed": "failed",
            "skipped": "skipped",
            "active": "ongoing",
            "pending": "pending",
        }.get(cs.status, cs.status)

        # NEW: If evaluation_data exists (AI finished), use the AI result instead of 'ongoing'
        if cs.evaluation_data:
            # For Stage 0, evaluation_data is the ResumeMatchAnalysis
            # For interview stages, it's the AI eval results
            if cs.status in ["active", "pending", "completed"]:
                if isinstance(cs.evaluation_data, dict):
                    # Extract pass_fail or result from AI data if present
                    ai_pf = cs.evaluation_data.get("pass_fail") or cs.evaluation_data.get("result")
                    if "is_passed" in cs.evaluation_data:
                        ai_pf = "passed" if cs.evaluation_data["is_passed"] else "failed"
                    
                    if ai_pf:
                        ai_result_val = ai_pf
                    elif "match_percentage" in cs.evaluation_data:
                        # Fallback for Stage 0 (Match percentage check)
                        score = cs.evaluation_data.get("match_percentage", 0)
                        threshold = 70.0 # Default threshold
                        ai_result_val = "passed" if score >= threshold else "failed"

        # Check for explicit HR decision
        hr_decision_val = None
        if cs.job_stage_id in decisions_by_stage:
            hr_decision_val = decisions_by_stage[cs.job_stage_id].decision

        # Result is primarily HR decision if it exists, otherwise AI result
        result_val = hr_decision_val or ai_result_val

        # Extract required_inputs from job stage config or template config
        req_inputs = []
        if cs.job_stage:
            config = cs.job_stage.config or {}
            template_config = (cs.job_stage.template.default_config if cs.job_stage.template else {}) or {}
            
            if "required_inputs" in config:
                req_inputs = config.get("required_inputs", [])
            elif "required_inputs" in template_config:
                req_inputs = template_config.get("required_inputs", [])

        return CandidateStageSummary(
            stage_id=cs.id,
            job_stage_id=cs.job_stage_id,
            template_name=cs.job_stage.template.name if cs.job_stage and cs.job_stage.template else "Unknown",
            status=response_status,
            order=cs.job_stage.stage_order if cs.job_stage else 1,
            job_id=cs.job_stage.job_id if cs.job_stage else None,
            job_name=cs.job_stage.job.title if cs.job_stage and cs.job_stage.job else None,
            completed_at=cs.completed_at,
            completed=is_finished,
            result=result_val,
            ai_result=ai_result_val,
            hr_decision=hr_decision_val or "pending",
            evaluation_data=cs.evaluation_data,
            required_inputs=req_inputs
        )

    sorted_stages = sorted(candidate_stages, key=lambda x: x.job_stage.stage_order if x.job_stage else 1)
    pipeline = [_map_stage(cs) for cs in sorted_stages]
    
    current_stage = None
    # If focus_stage_id is provided, filter the pipeline to ONLY that stage
    if focus_stage_id:
        focus_list = []
        if isinstance(focus_stage_id, (list, tuple, set)):
            focus_list = [str(item) for item in focus_stage_id]
        elif isinstance(focus_stage_id, str):
            focus_list = [focus_stage_id]
        
        focus_ids = set()
        focus_names = set()
        for fs in focus_list:
            try:
                focus_ids.add(str(uuid.UUID(fs)).lower())
            except ValueError:
                focus_names.add(fs.lower())

        filtered_pipeline = []
        for s in pipeline:
            if str(s.stage_id).lower() in focus_ids or (s.job_stage_id and str(s.job_stage_id).lower() in focus_ids):
                filtered_pipeline.append(s)
            elif s.template_name and s.template_name.lower() in focus_names:
                filtered_pipeline.append(s)
        
        # Update the pipeline with the filtered result
        if filtered_pipeline:
            pipeline = filtered_pipeline
            # When a user filters by a stage, they want the 'Stage' column to show their progress in THAT specific stage.
            current_stage = filtered_pipeline[0]

    # If no focus stage is provided (or no match found), use the candidate's ACTUAL current stage.
    if not current_stage:
        for cs in candidate_stages:
            if cs.status == "active":
                current_stage = _map_stage(cs)
                break
        
        if not current_stage:
            # No active stage — show the last non-pending stage (most recent progress)
            all_pipeline = [_map_stage(cs) for cs in sorted_stages]
            non_pending_stages = [s for s in all_pipeline if s.status != "pending"]
            if non_pending_stages:
                current_stage = non_pending_stages[-1]
            elif all_pipeline:
                current_stage = all_pipeline[0]

    # Job Context Overrides
    mapping_job_id = effective_filter_job_id
    mapping_job_name = None
    is_cross_match = False
    
    if target_job_id and candidate.applied_job_id:
        if str(candidate.applied_job_id).lower() != str(target_job_id).lower():
            is_cross_match = True

    if mapping_job_id:
        if candidate.applied_job and str(candidate.applied_job.id).lower() == str(mapping_job_id).lower():
            mapping_job_name = candidate.applied_job.title
        elif latest_resume and hasattr(latest_resume, "version_results"):
            for vr in latest_resume.version_results:
                if str(vr.job_id).lower() == str(mapping_job_id).lower():
                    mapping_job_name = vr.job.title if vr.job else None
                    break

    # Task mapping with fallback
    task_file_path = candidate.task_file_path
    task_skills = candidate.task_skills
    is_custom_task = False

    if not task_file_path and candidate.applied_job:
        task_file_path = candidate.applied_job.task_file_path
        task_skills = candidate.applied_job.task_skills
    else:
        is_custom_task = True if task_file_path else False
    
    def _title(val: str | None) -> str | None:
        if not val: return val
        return val.strip().title()

    # Smart Pruning: 
    # 1. If looking at an Interview Stage (Any stage after the first one), hide resume screening data.
    # 2. If looking at the First Stage (Screening) or no filter, show it.
    # Note: We calculate min_order from ALL candidate stages, not just the filtered pipeline.
    is_interview_focus = False
    if focus_stage_id and current_stage and candidate_stages:
        global_min_order = min((cs.job_stage.stage_order if cs.job_stage else 1) for cs in candidate_stages)
        if current_stage.order > global_min_order:
            is_interview_focus = True
    
    is_focused = focus_stage_id is not None
    
    return CandidateResponse(
        id=candidate.id,
        first_name=_title(candidate.first_name),
        last_name=_title(candidate.last_name),
        email=candidate.email,
        phone=candidate.phone,
        location=location,
        linkedin_url=linkedin_url,
        github_url=github_url,
        current_status=candidate.current_status,
        applied_job_id=candidate.applied_job_id,
        applied_version_number=candidate.applied_version_number,
        job_id=mapping_job_id,
        job_name=mapping_job_name,
        is_cross_match=is_cross_match,
        resume_id=latest_resume.id if latest_resume else None,
        created_at=candidate.created_at,
        resume_analysis=analysis if not is_interview_focus else None,
        resume_score=resume_score,
        pass_fail=pass_fail,
        is_parsed=is_parsed,
        processing_status=processing_status,
        processing_error=processing_error,
        hr_decision=status,
        hr_score=hr_score_val,
        version_results=version_results if not is_focused else [],
        current_stage=current_stage,
        pipeline=pipeline,
        task_file_path=task_file_path,
        task_skills=task_skills,
        is_custom_task=is_custom_task,
        github_evaluation_id=candidate.github_evaluation_id,
        email_sent_count=candidate.email_sent_count,
    )
