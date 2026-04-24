from datetime import datetime
import uuid

from sqlalchemy import func, or_, select, and_
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
        hr_decision: str | None = None,
        jd_version: int | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> PaginatedData[CandidateResponse]:
        from app.v1.db.models.cross_job_matches import CrossJobMatch

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

        dir_stmt = select(Candidate).where(dir_filter)

        search_filter = None
        if query:
            search_filter = or_(
                Candidate.first_name.ilike(f"%{query}%"),
                Candidate.last_name.ilike(f"%{query}%"),
                Candidate.email.ilike(f"%{query}%"),
            )
            dir_stmt = dir_stmt.where(search_filter)

        if hr_decision:
            latest_decision_subq = (
                select(HrDecision.decision)
                .where(HrDecision.candidate_id == Candidate.id)
                .order_by(HrDecision.decided_at.desc())
                .limit(1)
                .scalar_subquery()
            )
            dir_stmt = dir_stmt.where(latest_decision_subq == hr_decision)

        if jd_version is not None:
            dir_stmt = dir_stmt.where(Candidate.applied_version_number == jd_version)

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

        xm_stmt = (
            select(CrossJobMatch)
            .where(xm_filter)
            .options(
                selectinload(CrossJobMatch.candidate).selectinload(Candidate.resumes).selectinload(Resume.version_results).selectinload(ResumeVersionResult.job),
                selectinload(CrossJobMatch.candidate).selectinload(Candidate.hr_decisions),
                selectinload(CrossJobMatch.candidate).selectinload(Candidate.stages).selectinload(CandidateStage.job_stage).selectinload(JobStageConfig.template),
                selectinload(CrossJobMatch.candidate).selectinload(Candidate.location_rel),
                selectinload(CrossJobMatch.matched_job),
            )
        )
        if search_filter is not None:
            xm_stmt = xm_stmt.join(
                Candidate, CrossJobMatch.candidate_id == Candidate.id
            ).where(search_filter)

        xm_result = await db.execute(xm_stmt)
        cross_matches = list(xm_result.scalars().unique().all())

        # 3. Map to responses
        responses = []
        seen_candidate_ids = set()
        seen_emails = set()
        
        for c in direct_candidates:
            responses.append(self._map_candidate_to_response(c, target_job_id=job_id))
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
            resp = self._map_candidate_to_response(xm.candidate, target_job_id=job_id)

            # Apply hr_decision filter in-memory for cross-matches if needed
            if hr_decision:
                if resp.hr_decision != hr_decision:
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

        # 5. Paginate
        total = len(responses)
        paginated_responses = responses[skip : skip + limit]

        return PaginatedData[CandidateResponse](
            data=paginated_responses,
            total=total,
        )

    # Note: search_candidates_for_job has been merged into get_candidates_for_job


    async def search_candidates(
        self,
        db: AsyncSession,
        query: str | None = None,
        job: str | None = None,
        hr_decision: str | None = None,
        city: str | None = None,
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
        base_filter = or_(
            Candidate.applied_job_id.is_not(None),
            exists().where(CrossJobMatch.candidate_id == Candidate.id)
        )

        stmt = select(Candidate).where(base_filter)
        total_stmt = select(func.count()).select_from(Candidate).where(base_filter)

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
                # Direct UUID comparison — include native, cross-matched AND decided candidates
                from app.v1.db.models.hr_decisions import HrDecision
                xm_subq = select(CrossJobMatch.candidate_id).where(CrossJobMatch.matched_job_id == job)
                dec_subq = select(HrDecision.candidate_id).where(HrDecision.job_id == job)
                stmt = stmt.where(or_(Candidate.applied_job_id == job, Candidate.id.in_(xm_subq), Candidate.id.in_(dec_subq)))
                total_stmt = total_stmt.where(or_(Candidate.applied_job_id == job, Candidate.id.in_(xm_subq), Candidate.id.in_(dec_subq)))
            else:
                # Title search — include native, cross-matched AND decided candidates
                from app.v1.db.models.hr_decisions import HrDecision
                xm_subq = select(CrossJobMatch.candidate_id).join(Job, CrossJobMatch.matched_job_id == Job.id).where(Job.title.ilike(f"%{job}%"))
                dec_subq = select(HrDecision.candidate_id).join(Job, HrDecision.job_id == Job.id).where(Job.title.ilike(f"%{job}%"))
                stmt = stmt.outerjoin(Job, Candidate.applied_job_id == Job.id).where(
                    or_(Job.title.ilike(f"%{job}%"), Candidate.id.in_(xm_subq), Candidate.id.in_(dec_subq))
                )
                total_stmt = total_stmt.outerjoin(Job, Candidate.applied_job_id == Job.id).where(
                    or_(Job.title.ilike(f"%{job}%"), Candidate.id.in_(xm_subq), Candidate.id.in_(dec_subq))
                )

        # 3. City filter
        if city:
            stmt = stmt.join(Location, Candidate.location_id == Location.id).where(Location.name.ilike(f"%{city}%"))
            total_stmt = total_stmt.join(Location, Candidate.location_id == Location.id).where(Location.name.ilike(f"%{city}%"))

        # 4. HR Decision filter
        if hr_decision:
            # Map user-friendly labels to database values
            decision_map = {
                "approved": "approve",
                "proceed": "approve",
                "rejected": "reject",
                "maybe": "May Be"
            }
            mapped_decision = decision_map.get(hr_decision.lower(), hr_decision)

            latest_decision_subq = (
                select(HrDecision.decision)
                .where(HrDecision.candidate_id == Candidate.id)
                .order_by(HrDecision.decided_at.desc())
                .limit(1)
                .scalar_subquery()
            )
            stmt = stmt.where(latest_decision_subq == mapped_decision)
            total_stmt = total_stmt.where(latest_decision_subq == mapped_decision)

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
                selectinload(Candidate.hr_decisions),
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

        target_job_id = None
        if job:
            try:
                target_job_id = uuid.UUID(str(job))
            except ValueError:
                pass

        return PaginatedData[CandidateResponse](
            data=[self._map_candidate_to_response(c, target_job_id) for c in candidates],
            total=total or 0,
        )

    def _map_candidate_to_response(
        self, candidate: Candidate, target_job_id: uuid.UUID | None = None
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
        if target_job_id:
            target_job_str = str(target_job_id)
            # Filter HR decisions to this specific job ID, or fallback to natively applied if null
            filtered_decisions = []
            # Determine if candidate is cross-matched to this job
            is_cross_matched_here = False
            if target_job_id:
                from app.v1.db.models.cross_job_matches import CrossJobMatch
                xm_stmt = select(CrossJobMatch.id).where(
                    CrossJobMatch.candidate_id == candidate.id,
                    CrossJobMatch.matched_job_id == target_job_id
                )
                # Note: We are in a sync mapping function, but hr_decisions are already loaded.
                # However, checking CrossJobMatch would require a DB call.
                # Heuristic: if they have a decision and it's NOT their applied job, it's likely the cross-match.
                pass

            for d in hr_decisions:
                d_job_id = getattr(d, "job_id", None)
                if d_job_id:
                    if str(d_job_id) == target_job_str:
                        filtered_decisions.append(d)
                else:
                    # Fallback for null job_id: count if it's the native job OR if we are in a job-specific view
                    # (In get_candidates_for_job, we already know the candidate is either native or cross-matched).
                    if str(candidate.applied_job_id) == target_job_str:
                        filtered_decisions.append(d)
                    elif target_job_id:
                        # If we are in Job B and job_id is null, we'll assume the decision 
                        # belongs here if the candidate is in this job's pool
                        filtered_decisions.append(d)
            hr_decisions = filtered_decisions

        latest_decision = (
            max(hr_decisions, key=lambda d: d.decided_at) if hr_decisions else None
        )
        
        # Normalize decision string for frontend (e.g., "approve" -> "Approve")
        status = "Pending"
        if latest_decision:
            raw_status = str(latest_decision.decision).lower().strip()
            if raw_status == "approve":
                status = "Approve"
            elif raw_status == "reject":
                status = "Reject"
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
        pipeline = []
        candidate_stages = getattr(candidate, "stages", [])
        
        # Filter by target_job_id if provided (for cross-matches or specific job views)
        # Fallback to candidate's native applied_job_id for global search context
        effective_filter_job_id = target_job_id or candidate.applied_job_id
        if effective_filter_job_id:
            candidate_stages = [
                cs for cs in candidate_stages 
                if cs.job_stage and cs.job_stage.job_id == effective_filter_job_id
            ]
        
        # Ordered by stage order
        def _map_stage(cs) -> CandidateStageSummary:
            # Map database status to a standard API status for the response
            # Any finished stage is shown as 'completed' to the frontend
            is_finished = cs.status in ["completed", "failed", "skipped"]
            response_status = "completed" if is_finished else cs.status

            return CandidateStageSummary(
                stage_id=cs.id,
                template_name=cs.job_stage.template.name if cs.job_stage and cs.job_stage.template else "Unknown",
                status=response_status,
                order=cs.job_stage.stage_order if cs.job_stage else 0,
                job_id=cs.job_stage.job_id if cs.job_stage else None,
                job_name=cs.job_stage.job.title if cs.job_stage and cs.job_stage.job else None,
                completed_at=cs.completed_at,
                completed=is_finished,
                result={
                    "completed": "passed",
                    "failed": "failed",
                    "skipped": "skipped",
                    "active": "ongoing",
                    "pending": "pending",
                }.get(cs.status, cs.status),
            )

        pipeline = [_map_stage(cs) for cs in sorted(candidate_stages, key=lambda x: x.job_stage.stage_order if x.job_stage else 0)]
        
        current_stage = None
        for cs in candidate_stages:
            if cs.status == "active":
                current_stage = _map_stage(cs)
        
        # If no active stage found, use the last one that was processed (completed/failed/skipped)
        if not current_stage and pipeline:
            # Find the last stage that is NOT pending
            non_pending_stages = [s for s in pipeline if s.status != "pending"]
            if non_pending_stages:
                current_stage = non_pending_stages[-1]
            else:
                # Fallback to the first stage if all are pending
                current_stage = pipeline[0]

        # Force 'pending' status if HR hasn't made an initial decision yet for the first stage
        is_undecided = latest_decision is None or not latest_decision.decision
        if is_undecided and current_stage and current_stage.order == 1:
            current_stage.status = "pending"
            current_stage.result = "pending"
            # Update in pipeline list too
            for p in pipeline:
                if p.order == 1:
                    p.status = "pending"
                    p.result = "pending"

        # Job Context Overrides
        mapping_job_id = target_job_id or candidate.applied_job_id
        mapping_job_name = None
        is_cross_match = False
        
        if target_job_id:
            # It's a cross-match if target_job_id is different from the original application
            if str(candidate.applied_job_id) != str(target_job_id):
                is_cross_match = True

            # Try to find the job title from candidate's relationships
            if candidate.applied_job and candidate.applied_job.id == target_job_id:
                mapping_job_name = candidate.applied_job.title
            elif latest_resume and hasattr(latest_resume, "version_results"):
                for vr in latest_resume.version_results:
                    if vr.job_id == target_job_id:
                        mapping_job_name = vr.job.title if vr.job else None
                        break
        else:
            mapping_job_name = candidate.applied_job.title if candidate.applied_job else None

        def _title(val: str | None) -> str | None:
            """Format name to Title Case."""
            if not val:
                return val
            return val.strip().title()

        return CandidateResponse(
            id=candidate.id,
            first_name=_title(candidate.first_name),
            last_name=_title(candidate.last_name),
            email=candidate.email,
            phone=candidate.phone,
            location=location,
            linkedin_url=linkedin_url,
            github_url=github_url,
            current_status=current_stage.template_name if current_stage else candidate.current_status,
            applied_job_id=mapping_job_id,  # Overridden so the frontend local filter passes when returning cross-matched or decided candidates
            applied_version_number=candidate.applied_version_number,
            job_id=mapping_job_id,
            job_name=mapping_job_name,
            is_cross_match=is_cross_match,
            resume_id=latest_resume.id if latest_resume else None,
            created_at=candidate.created_at,
            resume_analysis=analysis,
            resume_score=resume_score,
            pass_fail=pass_fail,
            is_parsed=is_parsed,
            processing_status=processing_status,
            processing_error=processing_error,
            hr_decision=status,
            version_results=version_results,
            current_stage=current_stage,
            pipeline=pipeline,
        )


    async def delete_candidate_by_identifier(
        self, db: AsyncSession, identifier: str
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

        # Manually delete resume_chunks first (no cascade in DB constraint)
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

        await db.delete(candidate)
        await db.commit()
        return True


candidate_admin_service = CandidateAdminService()
