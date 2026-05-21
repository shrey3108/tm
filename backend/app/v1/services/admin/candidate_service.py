from datetime import datetime, timezone
import uuid
from fastapi import HTTPException

from sqlalchemy import func, or_, select, and_, exists
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
from app.v1.schemas.candidate_stage import CandidateStageSummary
from app.v1.core.cache import cache
from app.v1.services.admin.audit_service import audit_service


class CandidateAdminService:
    """
    Service for admin-level candidate management operations.
    """

    async def get_candidates_for_job(
        self,
        db: AsyncSession,
        job_id: uuid.UUID,
        skip: int = 0,
        limit: int = 100,
        query: str | None = None,
        hr_decision: list[str] | None = None,
        hr_score: list[int] | None = None,
        jd_version: list[int] | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        candidate_id: uuid.UUID | None = None,
        stage_id: list[str] | None = None,
        city: list[str] | None = None,
        result: list[str] | None = None,
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

            dir_filter = and_(
                dir_filter,
                select(1).select_from(CandidateStage).join(
                    JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id
                ).join(
                    StageTemplate, JobStageConfig.template_id == StageTemplate.id
                ).where(
                    and_(
                        CandidateStage.candidate_id == Candidate.id,
                        CandidateStage.status.in_(["active", "completed", "failed"]),
                        stage_filter
                    )
                ).exists()
            )

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
                
            latest_decision_subq = (
                select(func.lower(HrDecision.decision))
                .where(HrDecision.candidate_id == Candidate.id)
                .order_by(HrDecision.decided_at.desc())
                .limit(1)
                .scalar_subquery()
            )
            
            if "pending" in hr_decision:
                # Include candidates where the latest decision is 'pending' OR no decision exists at all
                dir_stmt = dir_stmt.where(
                    or_(
                        latest_decision_subq.in_(hr_decision),
                        latest_decision_subq.is_(None)
                    )
                )
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
            xm_filter = and_(
                xm_filter,
                select(1).select_from(CandidateStage).join(
                    JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id
                ).join(
                    StageTemplate, JobStageConfig.template_id == StageTemplate.id
                ).where(
                    and_(
                        CandidateStage.candidate_id == CrossJobMatch.candidate_id,
                        CandidateStage.status.in_(["active", "completed", "pending", "failed"]),
                        stage_filter
                    )
                ).exists()
            )

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
            responses.append(self._map_candidate_to_response(c, target_job_id=job_id, focus_stage_id=stage_id))
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
            resp = self._map_candidate_to_response(xm.candidate, target_job_id=job_id, focus_stage_id=stage_id)

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
        hr_score: list[int] | None = None,
        city: list[str] | None = None,
        result: list[str] | None = None,
        stage_id: list[str] | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        skip: int = 0,
        limit: int = 100,
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

            stage_exists_stmt = select(1).select_from(CandidateStage).join(
                JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id
            ).join(
                StageTemplate, JobStageConfig.template_id == StageTemplate.id
            ).where(
                and_(
                    CandidateStage.candidate_id == Candidate.id,
                    CandidateStage.status.in_(["active", "completed", "pending", "failed"]),
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

        mapped_responses = [self._map_candidate_to_response(c, focus_stage_id=stage_id) for c in candidates]
        
        # Filter out failed processing
        mapped_responses = [r for r in mapped_responses if r.processing_status != "failed"]

        return PaginatedData[CandidateResponse](
            data=mapped_responses,
            total=total,
        )

    def _map_candidate_to_response(
        self, candidate: Candidate, target_job_id: uuid.UUID | None = None, focus_stage_id: uuid.UUID | None = None
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
                        import re

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
                # Map it to the stage with order 0 if it exists.
                for cs in candidate_stages:
                    if cs.job_stage and cs.job_stage.stage_order == 0:
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
                if cs.status in ["active", "pending"]:
                    if isinstance(cs.evaluation_data, dict):
                        # Extract pass_fail from AI data if present
                        ai_pf = cs.evaluation_data.get("pass_fail") or cs.evaluation_data.get("result")
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

            return CandidateStageSummary(
                stage_id=cs.id,
                job_stage_id=cs.job_stage_id,
                template_name=cs.job_stage.template.name if cs.job_stage and cs.job_stage.template else "Unknown",
                status=response_status,
                order=cs.job_stage.stage_order if cs.job_stage else 0,
                job_id=cs.job_stage.job_id if cs.job_stage else None,
                job_name=cs.job_stage.job.title if cs.job_stage and cs.job_stage.job else None,
                completed_at=cs.completed_at,
                completed=is_finished,
                result=result_val,
                ai_result=ai_result_val,
                hr_decision=hr_decision_val or "pending",
                evaluation_data=cs.evaluation_data
            )

        sorted_stages = sorted(candidate_stages, key=lambda x: x.job_stage.stage_order if x.job_stage else 0)
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
        
        def _title(val: str | None) -> str | None:
            if not val: return val
            return val.strip().title()

        # Smart Pruning: 
        # 1. If looking at an Interview Stage (Any stage after the first one), hide resume screening data.
        # 2. If looking at the First Stage (Screening) or no filter, show it.
        # Note: We calculate min_order from ALL candidate stages, not just the filtered pipeline.
        is_interview_focus = False
        if focus_stage_id and current_stage and candidate_stages:
            global_min_order = min((cs.job_stage.stage_order if cs.job_stage else 0) for cs in candidate_stages)
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
        )


    async def delete_candidate_by_identifier(
        self, db: AsyncSession, admin_user_id: uuid.UUID, identifier: str
    ) -> bool:
        """
        Delete a candidate by ID or Email for testing purposes.
        """
        # Try to parse identifier as UUID
        candidate_id = None
        try:
            candidate_id = uuid.UUID(identifier)
        except ValueError:
            pass

        if candidate_id:
            stmt = select(Candidate).where(Candidate.id == candidate_id)
        else:
            stmt = select(Candidate).where(Candidate.email == identifier)

        result = await db.execute(stmt)
        candidate = result.scalar_one_or_none()

        if not candidate:
            return False

        # 1. Manually cleanup interview-related data first (Evaluation -> Transcript -> Recording -> Interview)
        # This is necessary because Transcripts reference Files, and Files are cascaded from Candidate.
        from sqlalchemy import delete
        from app.v1.db.models.interviews import Interview
        from app.v1.db.models.transcripts import Transcript
        from app.v1.db.models.evaluations import Evaluation
        from app.v1.db.models.recordings import Recording

        # Get all interview IDs for this candidate
        interview_ids_stmt = select(Interview.id).where(Interview.candidate_id == candidate.id)
        interview_ids_res = await db.execute(interview_ids_stmt)
        interview_ids = [row[0] for row in interview_ids_res.all()]

        if interview_ids:
            # Delete Evaluations linked to these interviews
            await db.execute(delete(Evaluation).where(Evaluation.interview_id.in_(interview_ids)))
            # Delete Transcripts linked to these interviews
            await db.execute(delete(Transcript).where(Transcript.interview_id.in_(interview_ids)))
            # Delete Recordings linked to these interviews
            await db.execute(delete(Recording).where(Recording.interview_id.in_(interview_ids)))
            # Delete the Interviews themselves
            await db.execute(delete(Interview).where(Interview.id.in_(interview_ids)))

        # 2. Manually delete resume_chunks (no cascade in DB constraint)
        from sqlalchemy import text
        from app.v1.db.models.resumes import Resume
        resume_ids_result = await db.execute(
            select(Resume.id).where(Resume.candidate_id == candidate.id)
        )
        resume_ids = [row[0] for row in resume_ids_result.all()]
        if resume_ids:
            await db.execute(
                text("DELETE FROM resume_chunks WHERE resume_id = ANY(:ids)"),
                {"ids": resume_ids}
            )

        # Capture candidate info before deletion for audit trail
        candidate_name = f"{candidate.first_name or ''} {candidate.last_name or ''}"
        candidate_email = candidate.email
        applied_job_id = candidate.applied_job_id

        await db.delete(candidate)
        await db.commit()

        # Audit log for candidate deletion
        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="delete_candidate",
            target_type="candidate",
            target_id=candidate_id,
            details={
                "name": candidate_name,
                "email": candidate_email,
                "job_id": str(applied_job_id) if applied_job_id else None
            }
        )
        return True



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
        from app.v1.db.models.candidate_stages import CandidateStage
        from app.v1.db.models.hr_decisions import HrDecision
        from app.v1.db.models.evaluations import Evaluation
        from app.v1.db.models.job_stage_configs import JobStageConfig
        from sqlalchemy import select, and_, or_
        from sqlalchemy.orm import selectinload
        from app.v1.db.models.resumes import Resume
        from app.v1.db.models.resume_version_results import ResumeVersionResult
        from app.v1.db.models.candidates import Candidate

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
                "failed": "failed",
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


candidate_admin_service = CandidateAdminService()
