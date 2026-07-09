"""
Candidate query service.

Extracted from candidate_service.py to keep file sizes manageable.
Handles fetching candidates for a specific job (including cross-job matches)
and searching candidates across all jobs with advanced filtering.
"""
from datetime import datetime
import uuid

from sqlalchemy import func, or_, select, and_, exists, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.v1.db.models.candidates import Candidate
from app.v1.db.models.hr_decisions import HrDecision
from app.v1.db.models.resumes import Resume
from app.v1.db.models.resume_version_results import ResumeVersionResult
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.job_stage_configs import JobStageConfig
from app.v1.schemas.upload import CandidateResponse, ResumeMatchAnalysis
from app.v1.schemas.response import PaginatedData
from app.v1.core.cache import cache
from app.v1.services.admin.candidate_mapping_service import map_candidate_to_response


class CandidateQueryService:
    """
    Service for querying candidates for a job and searching across jobs.
    """

    async def get_candidates_for_job(
        self,
        db: AsyncSession,
        job_id: uuid.UUID,
        skip: int = 0,
        limit: int = 100,
        query: str | None = None,
        hr_decision: list[str] | None = None,
        hr_score: list[float] | None = None,
        jd_version: list[int] | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        candidate_id: uuid.UUID | None = None,
        stage_id: list[str] | None = None,
        city: list[str] | None = None,
        result: list[str] | None = None,
        test_email_sent: bool | None = None,
    ) -> PaginatedData[CandidateResponse]:
        from app.v1.db.models.cross_job_matches import CrossJobMatch
        from app.v1.db.models.candidate_stages import CandidateStage
        from app.v1.db.models.job_stage_configs import JobStageConfig
        from app.v1.db.models.stage_templates import StageTemplate

        # 0. Cache lookup
        cache_key = f"candidates:for_job:{job_id}:{skip}:{limit}"
        if query: cache_key += f":q_{query}"
        if hr_decision: cache_key += f":hr_{sorted(hr_decision)}"
        if hr_score: cache_key += f":score_{sorted(hr_score)}"
        if jd_version: cache_key += f":v_{sorted(jd_version)}"
        if start_date: cache_key += f":sd_{start_date.isoformat()}"
        if end_date: cache_key += f":ed_{end_date.isoformat()}"
        if candidate_id: cache_key += f":c_{candidate_id}"
        if stage_id: cache_key += f":s_{stage_id}"
        if city: cache_key += f":city_{city}"
        if result: cache_key += f":res_{result}"
        if test_email_sent is not None: cache_key += f":es_{test_email_sent}"

        cached = await cache.get(cache_key)
        if cached:
            try:
                return PaginatedData[CandidateResponse](
                    data=[CandidateResponse.model_validate(c) for c in cached["data"]],
                    total=cached["total"]
                )
            except Exception:
                pass

        # 0.1 Stage filter processing
        print(f"[DEBUG] get_candidates_for_job called: job_id={job_id}, stage_id={stage_id}")
        stage_ids = []
        stage_names = []
        stage_filter = None
        if stage_id:
            for s in stage_id:
                try:
                    stage_ids.append(uuid.UUID(s))
                except ValueError:
                    stage_names.append(s.lower())
            
            stage_filter = or_()
            if stage_ids:
                stage_filter = or_(stage_filter, CandidateStage.id.in_(stage_ids), CandidateStage.job_stage_id.in_(stage_ids))
            if stage_names:
                stage_filter = or_(stage_filter, func.lower(StageTemplate.name).in_(stage_names))

        # 1. Fetch direct candidates
        dir_filter = or_(
            Candidate.applied_job_id == job_id,
            Candidate.id.in_(
                select(HrDecision.candidate_id).where(HrDecision.job_id == job_id)
            )
        )
        
        # Apply date filters to direct candidates
        if start_date:
            dir_filter = and_(dir_filter, Candidate.created_at >= start_date)
        if end_date:
            dir_filter = and_(dir_filter, Candidate.created_at <= end_date)

        if candidate_id:
            dir_filter = and_(dir_filter, Candidate.id == candidate_id)

        if stage_id:
            latest_stage_id_subq = (
                select(CandidateStage.job_stage_id)
                .join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
                .where(
                    and_(
                        CandidateStage.candidate_id == Candidate.id,
                        JobStageConfig.job_id == job_id
                    )
                )
                .order_by(
                    case(
                        (CandidateStage.status == "active", 2),
                        (CandidateStage.status != "pending", 1),
                        else_=0
                    ).desc(),
                    case(
                        (CandidateStage.status != "pending", JobStageConfig.stage_order),
                        else_=-JobStageConfig.stage_order
                    ).desc()
                )
                .limit(1)
                .correlate(Candidate)
                .scalar_subquery()
            )

            stage_exists = select(1).select_from(CandidateStage).join(
                JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id
            ).join(
                StageTemplate, JobStageConfig.template_id == StageTemplate.id
            ).where(
                and_(
                    CandidateStage.candidate_id == Candidate.id,
                    CandidateStage.job_stage_id == latest_stage_id_subq,
                    stage_filter
                )
            ).exists()
            
            if "resume screening" in stage_names:
                dir_filter = and_(
                    dir_filter,
                    or_(
                        stage_exists,
                        ~Candidate.stages.any(
                            CandidateStage.job_stage.has(JobStageConfig.job_id == job_id)
                        )
                    )
                )
            else:
                dir_filter = and_(dir_filter, stage_exists)

        if city:
            from app.v1.db.models.locations import Location
            city_lower = [c.lower() for c in city]
            dir_filter = and_(
                dir_filter,
                exists().where(
                    and_(
                        Candidate.location_id == Location.id,
                        func.lower(Location.name).in_(city_lower)
                    )
                ).correlate(Candidate)
            )

        if result:
            dir_filter = and_(dir_filter, Resume.pass_fail.in_(result))

        if test_email_sent is not None:
            from app.v1.db.models.candidate_test_paper import CandidateTestPaper
            
            from app.v1.utils.stage import get_question_round_filter
            
            tech_round_cond = Candidate.stages.any(
                and_(
                    CandidateStage.job_stage.has(
                        and_(
                            JobStageConfig.template_id == StageTemplate.id,
                            get_question_round_filter(JobStageConfig, StageTemplate)
                        )
                    ),
                    CandidateStage.status == "active"
                )
            )
            
            email_cond = exists().where(
                and_(
                    CandidateTestPaper.candidate_id == Candidate.id,
                    CandidateTestPaper.email_sent_count > 0
                )
            ).correlate(Candidate)
            
            if test_email_sent:
                dir_filter = and_(dir_filter, tech_round_cond, email_cond)
            else:
                dir_filter = and_(dir_filter, tech_round_cond, ~email_cond)


        dir_stmt = select(Candidate).join(Resume, Resume.candidate_id == Candidate.id).where(
            dir_filter
        )

        search_filter = None
        if query:
            search_filter = or_(
                Candidate.first_name.ilike(f"%{query}%"),
                Candidate.last_name.ilike(f"%{query}%"),
                Candidate.email.ilike(f"%{query}%"),
            )
            dir_stmt = dir_stmt.where(search_filter)

        if hr_decision:
            decision_map = {
                "passed": "pass",
                "approved": "pass",
                "proceed": "pass",
                "failed": "fail",
                "rejected": "fail",
                "maybe": "may be",
                "pending": "pending"
            }
            hr_decision = [decision_map.get(d.lower(), d.lower()) for d in hr_decision]
                
            latest_decision_stmt = select(func.lower(HrDecision.decision)).where(HrDecision.candidate_id == Candidate.id)
            
            if stage_id:
                decision_stage_filter = or_()
                if stage_ids:
                    decision_stage_filter = or_(decision_stage_filter, HrDecision.stage_config_id.in_(stage_ids))
                if stage_names:
                    decision_stage_filter = or_(
                        decision_stage_filter,
                        exists().where(
                            and_(
                                JobStageConfig.id == HrDecision.stage_config_id,
                                JobStageConfig.template_id == StageTemplate.id,
                                func.lower(StageTemplate.name).in_(stage_names)
                            )
                        )
                    )
                    if "resume screening" in stage_names:
                        decision_stage_filter = or_(decision_stage_filter, HrDecision.stage_config_id.is_(None))
                
                latest_decision_stmt = latest_decision_stmt.where(decision_stage_filter)

            latest_decision_subq = (
                latest_decision_stmt
                .order_by(HrDecision.decided_at.desc())
                .limit(1)
                .scalar_subquery()
            )
            
            if "pending" in hr_decision:
                # Include candidates where the latest decision (for the selected stage if given) is 'pending' OR no decision exists at all
                pending_conditions = [
                    latest_decision_subq.in_(hr_decision),
                    latest_decision_subq.is_(None)
                ]
                
                # If globally filtering for pending (no stage specified), include candidates currently active in a stage
                if not stage_id:
                    pending_conditions.append(
                        or_(
                            Candidate.current_status.ilike("%(Active)%"),
                            Candidate.current_status.ilike("%Pending%"),
                            Candidate.current_status.is_(None)
                        )
                    )
                    
                dir_stmt = dir_stmt.where(or_(*pending_conditions))
            else:
                dir_stmt = dir_stmt.where(latest_decision_subq.in_(hr_decision))

        if hr_score:
            if stage_id:
                # Filter by score in the selected stages
                decision_stage_filter = or_()
                if stage_ids:
                    decision_stage_filter = or_(decision_stage_filter, HrDecision.stage_config_id.in_(stage_ids))
                if stage_names:
                    decision_stage_filter = or_(
                        decision_stage_filter,
                        exists().where(
                            and_(
                                JobStageConfig.id == HrDecision.stage_config_id,
                                JobStageConfig.template_id == StageTemplate.id,
                                func.lower(StageTemplate.name).in_(stage_names)
                            )
                        )
                    )
                    if "resume screening" in stage_names:
                        decision_stage_filter = or_(decision_stage_filter, HrDecision.stage_config_id.is_(None))
                
                # 1. Match score in selected stage
                cond_stage_score = exists().where(
                    and_(
                        HrDecision.candidate_id == Candidate.id,
                        HrDecision.score.in_(hr_score),
                        decision_stage_filter
                    )
                )
                
                dir_stmt = dir_stmt.where(cond_stage_score)
            else:
                latest_score_subq = (
                    select(HrDecision.score)
                    .where(HrDecision.candidate_id == Candidate.id)
                    .order_by(HrDecision.decided_at.desc())
                    .limit(1)
                    .scalar_subquery()
                )
                dir_stmt = dir_stmt.where(latest_score_subq.in_(hr_score))

        if jd_version:
            dir_stmt = dir_stmt.where(Candidate.applied_version_number.in_(jd_version))

        dir_stmt = dir_stmt.options(
            selectinload(Candidate.resumes).selectinload(Resume.version_results).selectinload(ResumeVersionResult.job),
            selectinload(Candidate.hr_decisions),
            selectinload(Candidate.applied_job),
            selectinload(Candidate.stages).selectinload(CandidateStage.job_stage).selectinload(JobStageConfig.template),
            selectinload(Candidate.stages).selectinload(CandidateStage.job_stage).selectinload(JobStageConfig.job),
            selectinload(Candidate.location_rel),
        )
        dir_result = await db.execute(dir_stmt)
        direct_candidates = list(dir_result.scalars().unique().all())

        # 2. Fetch cross-matched candidates
        xm_filter = CrossJobMatch.matched_job_id == job_id
        if start_date:
            xm_filter = and_(xm_filter, CrossJobMatch.created_at >= start_date)
        if end_date:
            xm_filter = and_(xm_filter, CrossJobMatch.created_at <= end_date)

        if candidate_id:
            xm_filter = and_(xm_filter, CrossJobMatch.candidate_id == candidate_id)
        
        if stage_id:
            xm_latest_stage_id_subq = (
                select(CandidateStage.job_stage_id)
                .join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
                .where(
                    and_(
                        CandidateStage.candidate_id == CrossJobMatch.candidate_id,
                        JobStageConfig.job_id == job_id
                    )
                )
                .order_by(
                    case(
                        (CandidateStage.status == "active", 2),
                        (CandidateStage.status != "pending", 1),
                        else_=0
                    ).desc(),
                    case(
                        (CandidateStage.status != "pending", JobStageConfig.stage_order),
                        else_=-JobStageConfig.stage_order
                    ).desc()
                )
                .limit(1)
                .correlate(CrossJobMatch)
                .scalar_subquery()
            )

            xm_stage_exists = select(1).select_from(CandidateStage).join(
                JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id
            ).join(
                StageTemplate, JobStageConfig.template_id == StageTemplate.id
            ).where(
                and_(
                    CandidateStage.candidate_id == CrossJobMatch.candidate_id,
                    CandidateStage.job_stage_id == xm_latest_stage_id_subq,
                    stage_filter
                )
            ).exists()
            
            if "resume screening" in stage_names:
                xm_filter = and_(
                    xm_filter,
                    or_(
                        xm_stage_exists,
                        ~CrossJobMatch.candidate.has(
                            Candidate.stages.any(
                                CandidateStage.job_stage.has(JobStageConfig.job_id == job_id)
                            )
                        )
                    )
                )
            else:
                xm_filter = and_(xm_filter, xm_stage_exists)

        xm_stmt = (
            select(CrossJobMatch)
            .join(Candidate, CrossJobMatch.candidate_id == Candidate.id)
            .join(Resume, Resume.candidate_id == Candidate.id)
            .where(
                and_(xm_filter, Resume.parsed.is_(True))
            )
            .options(
                selectinload(CrossJobMatch.candidate).selectinload(Candidate.resumes).selectinload(Resume.version_results).selectinload(ResumeVersionResult.job),
                selectinload(CrossJobMatch.candidate).selectinload(Candidate.hr_decisions),
                selectinload(CrossJobMatch.candidate).selectinload(Candidate.stages).selectinload(CandidateStage.job_stage).selectinload(JobStageConfig.template),
                selectinload(CrossJobMatch.candidate).selectinload(Candidate.stages).selectinload(CandidateStage.job_stage).selectinload(JobStageConfig.job),
                selectinload(CrossJobMatch.candidate).selectinload(Candidate.location_rel),
                selectinload(CrossJobMatch.matched_job),
            )
        )
        if search_filter is not None:
            xm_stmt = xm_stmt.where(search_filter)

        xm_result = await db.execute(xm_stmt)
        cross_matches = list(xm_result.scalars().unique().all())

        # 3. Map to responses
        responses = []
        seen_candidate_ids = set()
        seen_emails = set()
        
        for c in direct_candidates:
            resp = map_candidate_to_response(c, target_job_id=job_id, focus_stage_id=stage_id)
            
            # If candidate applied for a different job originally, they are fundamentally a cross-match
            # We must override their score/analysis with the cross_job_matches data for this target job.
            if c.applied_job_id and str(c.applied_job_id) != str(job_id):
                specific_version = next((vr for vr in (resp.version_results or []) if vr.get("job_id") == str(job_id)), None)
                if specific_version:
                    analysis_obj = None
                    if specific_version.get("analysis_data"):
                        try:
                            analysis_obj = ResumeMatchAnalysis.model_validate(specific_version["analysis_data"])
                        except Exception:
                            pass
                    resp = resp.model_copy(
                        update={
                            "resume_score": float(specific_version.get("resume_score", 0.0)) if specific_version.get("resume_score") is not None else 0.0,
                            "pass_fail": specific_version.get("pass_fail"),
                            "resume_analysis": analysis_obj,
                        }
                    )
                else:
                    xm = next((x for x in cross_matches if x.candidate_id == c.id), None)
                    if xm:
                        analysis_obj = None
                        if xm.match_analysis:
                            try:
                                analysis_obj = ResumeMatchAnalysis.model_validate(xm.match_analysis)
                            except Exception:
                                pass

                        match_score_val = float(xm.match_score) if xm.match_score is not None else 0.0
                        threshold_val = float(xm.matched_job.passing_threshold) if xm.matched_job and xm.matched_job.passing_threshold else 70.0
                        derived_pass_fail = "passed" if match_score_val >= threshold_val else "failed"

                        resp = resp.model_copy(
                            update={
                                "applied_version_number": (xm.matched_job.version if xm.matched_job else resp.applied_version_number),
                                "resume_score": match_score_val,
                                "pass_fail": derived_pass_fail,
                                "resume_analysis": analysis_obj,
                                "created_at": xm.created_at,
                            }
                        )
                    
            responses.append(resp)
            seen_candidate_ids.add(c.id)
            if c.email:
                seen_emails.add(c.email.lower().strip())

        for xm in cross_matches:
            if not xm.candidate:
                continue
            
            # Skip if already in the list (by ID or by Email)
            if xm.candidate_id in seen_candidate_ids:
                continue
            
            cand_email = (xm.candidate.email.lower().strip() if xm.candidate.email else None)
            if cand_email and cand_email in seen_emails:
                continue

            # Record that we've seen this candidate
            seen_candidate_ids.add(xm.candidate_id)
            if cand_email:
                seen_emails.add(cand_email)

            # Map candidate normally
            resp = map_candidate_to_response(xm.candidate, target_job_id=job_id, focus_stage_id=stage_id)

            # Apply hr_decision filter in-memory for cross-matches if needed
            if hr_decision:
                # Case-insensitive check
                current_dec = resp.hr_decision.lower() if resp.hr_decision else "pending"
                if current_dec not in [d.lower() for d in hr_decision]:
                    continue

            # Apply hr_score filter in-memory for cross-matches if needed
            if hr_score:
                current_score = resp.hr_score
                if current_score is None or int(current_score) not in hr_score:
                    continue
            
            # Apply result (AI pass_fail) filter in-memory for cross-matches
            if result:
                if resp.pass_fail not in result:
                    continue

            specific_version = next((vr for vr in (resp.version_results or []) if vr.get("job_id") == str(job_id)), None)
            if specific_version:
                analysis_obj = None
                if specific_version.get("analysis_data"):
                    try:
                        analysis_obj = ResumeMatchAnalysis.model_validate(specific_version["analysis_data"])
                    except Exception:
                        pass
                resp = resp.model_copy(
                    update={
                        "resume_score": float(specific_version.get("resume_score", 0.0)) if specific_version.get("resume_score") is not None else 0.0,
                        "pass_fail": specific_version.get("pass_fail"),
                        "resume_analysis": analysis_obj,
                        "created_at": xm.created_at,
                    }
                )
            else:
                # Retrieve match analysis as object (OVERRIDE)
                analysis_obj = None
                if xm.match_analysis:
                    try:
                        analysis_obj = ResumeMatchAnalysis.model_validate(xm.match_analysis)
                    except Exception:
                        pass

                # Calculate pass_fail dynamically based on this job's threshold
                match_score_val = (
                    float(xm.match_score) if xm.match_score is not None else 0.0
                )
                threshold_val = (
                    float(xm.matched_job.passing_threshold)
                    if xm.matched_job and xm.matched_job.passing_threshold
                    else 70.0
                )
                derived_pass_fail = (
                    "passed" if match_score_val >= threshold_val else "failed"
                )

                # Override with cross-match data securely via model_copy
                resp = resp.model_copy(
                    update={
                        "applied_version_number": (
                            xm.matched_job.version if xm.matched_job else resp.applied_version_number
                        ),
                        "resume_score": match_score_val,
                        "pass_fail": derived_pass_fail,
                        "resume_analysis": analysis_obj,
                        "created_at": xm.created_at,
                    }
                )

            responses.append(resp)

        # 4. Sort entirely by created_at (most recent first)
        responses.sort(key=lambda x: x.created_at, reverse=True)

        # 4.1 Filter out failed processing (Hide candidates that failed to parse)
        responses = [r for r in responses if r.processing_status != "failed"]

        # 5. Paginate
        total = len(responses)
        paginated_responses = responses[skip : skip + limit]

        result = PaginatedData[CandidateResponse](
            data=paginated_responses,
            total=total,
        )

        # Cache the result (serialized to dicts)
        await cache.set(cache_key, {
            "data": [r.model_dump() for r in paginated_responses],
            "total": total
        }, ttl=300) # 5 min

        return result

    # Note: search_candidates_for_job has been merged into get_candidates_for_job

    async def search_candidates(
        self,
        db: AsyncSession,
        query: str | None = None,
        job: str | None = None,
        hr_decision: list[str] | None = None,
        hr_score: list[float] | None = None,
        city: list[str] | None = None,
        result: list[str] | None = None,
        stage_id: list[str] | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        skip: int = 0,
        limit: int = 100,
        test_email_sent: bool | None = None,
    ) -> PaginatedData[CandidateResponse]:
        """Search candidates across all jobs with advanced filtering."""
        from app.v1.db.models.jobs import Job
        from app.v1.db.models.locations import Location

        # Data and count queries
        from app.v1.db.models.cross_job_matches import CrossJobMatch
        from sqlalchemy import exists

        # Base filter: Candidate must have a primary job OR at least one cross-match entry
        # AND must have a successfully parsed resume
        base_filter = or_(
            Candidate.applied_job_id.is_not(None),
            exists().where(CrossJobMatch.candidate_id == Candidate.id)
        )

        from app.v1.db.models.stage_templates import StageTemplate
        from app.v1.db.models.job_stage_configs import JobStageConfig
        from app.v1.db.models.candidate_stages import CandidateStage

        stmt = select(Candidate).join(Resume, Resume.candidate_id == Candidate.id).where(base_filter)
        total_stmt = select(func.count(func.distinct(Candidate.id))).select_from(Candidate).join(Resume, Resume.candidate_id == Candidate.id).where(base_filter)

        # 1. Base query filter
        if query:
            search_filter = or_(
                Candidate.first_name.ilike(f"%{query}%"),
                Candidate.last_name.ilike(f"%{query}%"),
                Candidate.email.ilike(f"%{query}%"),
            )
            stmt = stmt.where(search_filter)
            total_stmt = total_stmt.where(search_filter)

        # 2. Job filter (UUID or Title)
        if job:
            is_uuid = False
            try:
                uuid.UUID(str(job))
                is_uuid = True
            except ValueError:
                pass

            if is_uuid:
                # Direct UUID comparison
                xm_subq = select(CrossJobMatch.candidate_id).where(CrossJobMatch.matched_job_id == job)
                stmt = stmt.where(or_(Candidate.applied_job_id == job, Candidate.id.in_(xm_subq)))
                total_stmt = total_stmt.where(or_(Candidate.applied_job_id == job, Candidate.id.in_(xm_subq)))
            else:
                # Title search
                xm_subq = select(CrossJobMatch.candidate_id).join(Job, CrossJobMatch.matched_job_id == Job.id).where(Job.title.ilike(f"%{job}%"))
                stmt = stmt.outerjoin(Job, Candidate.applied_job_id == Job.id).where(
                    or_(Job.title.ilike(f"%{job}%"), Candidate.id.in_(xm_subq))
                )
                total_stmt = total_stmt.outerjoin(Job, Candidate.applied_job_id == Job.id).where(
                    or_(Job.title.ilike(f"%{job}%"), Candidate.id.in_(xm_subq))
                )

        # 3. City filter
        if city:
            city_lower = [c.lower() for c in city]
            stmt = stmt.join(Location, Candidate.location_id == Location.id).where(func.lower(Location.name).in_(city_lower))
            total_stmt = total_stmt.join(Location, Candidate.location_id == Location.id).where(func.lower(Location.name).in_(city_lower))

        # 4. HR Decision filter
        if hr_decision:
            if isinstance(hr_decision, str):
                hr_decision = [hr_decision]
                
            # Map user-friendly labels to database values
            decision_map = {
                "passed": "pass",
                "approved": "pass",
                "proceed": "pass",
                "failed": "fail",
                "rejected": "fail",
                "maybe": "may be"
            }
            hr_decision = [decision_map.get(d.lower(), d.lower()) for d in hr_decision]
            
            latest_decision_subq = (
                select(func.lower(HrDecision.decision))
                .where(HrDecision.candidate_id == Candidate.id)
                .order_by(HrDecision.decided_at.desc())
                .limit(1)
                .scalar_subquery()
            )
            
            if "pending" in hr_decision:
                stmt = stmt.where(or_(latest_decision_subq.in_(hr_decision), latest_decision_subq.is_(None)))
                total_stmt = total_stmt.where(or_(latest_decision_subq.in_(hr_decision), latest_decision_subq.is_(None)))
            else:
                stmt = stmt.where(latest_decision_subq.in_(hr_decision))
                total_stmt = total_stmt.where(latest_decision_subq.in_(hr_decision))

        if hr_score:
            if stage_id:
                # Resolve stage template names & ids for decision filtering
                stage_ids = []
                stage_names = []
                for s in stage_id:
                    try:
                        stage_ids.append(uuid.UUID(s))
                    except ValueError:
                        stage_names.append(s.lower())
                
                decision_stage_filter = or_()
                if stage_ids:
                    decision_stage_filter = or_(decision_stage_filter, HrDecision.stage_config_id.in_(stage_ids))
                if stage_names:
                    decision_stage_filter = or_(
                        decision_stage_filter,
                        exists().where(
                            and_(
                                JobStageConfig.id == HrDecision.stage_config_id,
                                JobStageConfig.template_id == StageTemplate.id,
                                func.lower(StageTemplate.name).in_(stage_names)
                            )
                        )
                    )
                    if "resume screening" in stage_names:
                        decision_stage_filter = or_(decision_stage_filter, HrDecision.stage_config_id.is_(None))
                
                # 1. Match score in selected stage
                cond_stage_score = exists().where(
                    and_(
                        HrDecision.candidate_id == Candidate.id,
                        HrDecision.score.in_(hr_score),
                        decision_stage_filter
                    )
                )
                
                stmt = stmt.where(cond_stage_score)
                total_stmt = total_stmt.where(cond_stage_score)
            else:
                latest_score_subq = (
                    select(HrDecision.score)
                    .where(HrDecision.candidate_id == Candidate.id)
                    .order_by(HrDecision.decided_at.desc())
                    .limit(1)
                    .scalar_subquery()
                )
                stmt = stmt.where(latest_score_subq.in_(hr_score))
                total_stmt = total_stmt.where(latest_score_subq.in_(hr_score))

        # 5. AI Result filter
        if result:
            stmt = stmt.where(Resume.pass_fail.in_(result))
            total_stmt = total_stmt.where(Resume.pass_fail.in_(result))

        if test_email_sent is not None:
            from app.v1.db.models.candidate_test_paper import CandidateTestPaper
            
            from app.v1.utils.stage import get_question_round_filter
            
            tech_round_cond = Candidate.stages.any(
                and_(
                    CandidateStage.job_stage.has(
                        and_(
                            JobStageConfig.template_id == StageTemplate.id,
                            get_question_round_filter(JobStageConfig, StageTemplate)
                        )
                    ),
                    CandidateStage.status == "active"
                )
            )
            
            email_cond = exists().where(
                and_(
                    CandidateTestPaper.candidate_id == Candidate.id,
                    CandidateTestPaper.email_sent_count > 0
                )
            ).correlate(Candidate)
            
            if test_email_sent:
                stmt = stmt.where(and_(tech_round_cond, email_cond))
                total_stmt = total_stmt.where(and_(tech_round_cond, email_cond))
            else:
                stmt = stmt.where(and_(tech_round_cond, ~email_cond))
                total_stmt = total_stmt.where(and_(tech_round_cond, ~email_cond))

        # 6. Stages filter
        if stage_id:
            stage_ids = []
            stage_names = []
            for s in stage_id:
                try:
                    stage_ids.append(uuid.UUID(s))
                except ValueError:
                    stage_names.append(s.lower())
            
            stage_filter = or_()
            if stage_ids:
                stage_filter = or_(stage_filter, CandidateStage.id.in_(stage_ids), CandidateStage.job_stage_id.in_(stage_ids))
            if stage_names:
                stage_filter = or_(stage_filter, func.lower(StageTemplate.name).in_(stage_names))

            search_latest_stage_id_subq = (
                select(CandidateStage.job_stage_id)
                .join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
                .where(CandidateStage.candidate_id == Candidate.id)
                .order_by(
                    case(
                        (CandidateStage.status == "active", 2),
                        (CandidateStage.status != "pending", 1),
                        else_=0
                    ).desc(),
                    case(
                        (CandidateStage.status != "pending", JobStageConfig.stage_order),
                        else_=-JobStageConfig.stage_order
                    ).desc()
                )
                .limit(1)
                .correlate(Candidate)
                .scalar_subquery()
            )

            stage_exists_stmt = select(1).select_from(CandidateStage).join(
                JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id
            ).join(
                StageTemplate, JobStageConfig.template_id == StageTemplate.id
            ).where(
                and_(
                    CandidateStage.candidate_id == Candidate.id,
                    CandidateStage.job_stage_id == search_latest_stage_id_subq,
                    stage_filter
                )
            ).exists()
            
            stmt = stmt.where(stage_exists_stmt)
            total_stmt = total_stmt.where(stage_exists_stmt)

        # 5. Date filters
        if start_date:
            stmt = stmt.where(Candidate.created_at >= start_date)
            total_stmt = total_stmt.where(Candidate.created_at >= start_date)
        if end_date:
            stmt = stmt.where(Candidate.created_at <= end_date)
            total_stmt = total_stmt.where(Candidate.created_at <= end_date)

        total = await db.scalar(total_stmt)

        # Apply paging and ordering
        stmt = (
            stmt.options(
                selectinload(Candidate.resumes).selectinload(Resume.version_results).selectinload(ResumeVersionResult.job),
                selectinload(Candidate.hr_decisions).selectinload(HrDecision.stage_config).selectinload(JobStageConfig.template),
                selectinload(Candidate.applied_job),
                selectinload(Candidate.stages).selectinload(CandidateStage.job_stage).selectinload(JobStageConfig.template),
                selectinload(Candidate.location_rel),
            )
            .order_by(Candidate.created_at.desc())
            .offset(skip)
            .limit(limit)
        )

        result = await db.execute(stmt)
        candidates = list(result.scalars().unique().all())

        mapped_responses = [map_candidate_to_response(c, focus_stage_id=stage_id) for c in candidates]
        
        # Filter out failed processing
        mapped_responses = [r for r in mapped_responses if r.processing_status != "failed"]

        return PaginatedData[CandidateResponse](
            data=mapped_responses,
            total=total,
        )


candidate_query_service = CandidateQueryService()
