"""
Job Stats Service

Provides a single method `get_job_stats(db, job_id)` that aggregates:

  1. result   — AI screening pass/fail counts for native + cross-match candidates
  2. location — how many candidates per city (native candidates only, by location_rel)
  3. stages   — how many candidates are on each named hiring stage
  4. hr_decisions — approve / reject / Maybe / undecided counts for the job

This service is COMPLETELY ISOLATED. It does NOT import or modify any
existing service or route. It queries the DB directly using SQLAlchemy core.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from sqlalchemy import func, select, or_, and_, case, Text, cast, Date
from sqlalchemy.orm import selectinload
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.models.candidates import Candidate
from app.v1.db.models.resumes import Resume
from app.v1.db.models.cross_job_matches import CrossJobMatch
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.job_stage_configs import JobStageConfig
from app.v1.db.models.stage_templates import StageTemplate
from app.v1.db.models.hr_decisions import HrDecision
from app.v1.db.models.locations import Location
from app.v1.db.models.resume_version_results import ResumeVersionResult
from app.v1.db.models.evaluations import Evaluation
from app.v1.schemas.job_stats import (
    JobResultStats,
    JobHRDecisionStats,
    JobPriorityTimeline,
    JobStatsResponse,
    JobStageDetails,
)

from app.v1.core.cache import cache


class JobStatsService:
    """Aggregates various statistics for a specific job."""

    async def get_job_stats(
        self,
        db: AsyncSession,
        job_id: uuid.UUID,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> JobStatsResponse:
        """
        Returns a comprehensive stats snapshot for a job.

        Args:
            db:         Async SQLAlchemy session.
            job_id:     UUID of the job to inspect.
            start_date: Optional start date for filtering.
            end_date:   Optional end date for filtering.

        Returns:
            JobStatsResponse with result, location, stages, and hr_decisions.
        """
        # Cache lookup
        cache_key = f"job_stats:{job_id}"
        if start_date:
            cache_key += f":{start_date.isoformat()}"
        if end_date:
            cache_key += f":{end_date.isoformat()}"

        cached_data = await cache.get(cache_key)
        if cached_data:
            try:
                return JobStatsResponse.model_validate(cached_data)
            except Exception:
                # If validation fails (e.g. schema changed), fall back to DB
                pass

        result = await self._get_result_stats(db, job_id, start_date, end_date)
        location = await self._get_location_stats(db, job_id, start_date, end_date)
        stages = await self._get_stage_stats(db, job_id, start_date, end_date)
        hr_decisions = await self._get_hr_decision_stats(db, job_id, start_date, end_date)
        stage_details = await self._get_stage_details(db, job_id, start_date, end_date)
        priority_timeline = await self._get_priority_timeline(db, job_id)

        stats_response = JobStatsResponse(
            result=result,
            location=location,
            stages=stages,
            hr_decisions=hr_decisions,
            stage_details=stage_details,
            priority_timeline=priority_timeline,
        )

        # Store in cache (5 minutes TTL)
        await cache.set(cache_key, stats_response.model_dump(), ttl=300)

        return stats_response

    # -------------------------------------------------------------------------
    # Private helpers
    # -------------------------------------------------------------------------

    async def _get_result_stats(
        self, db: AsyncSession, job_id: uuid.UUID, start_date: datetime | None, end_date: datetime | None
    ) -> JobResultStats:
        """
        Count pass / fail / pending for unique candidates in this job.
        Prioritizes native Resume status over cross-match scores.
        """
        from app.v1.db.models.jobs import Job
        job = await db.get(Job, job_id)
        threshold = (
            float(job.passing_threshold) if job and job.passing_threshold else 70.0
        )

        # Filters for native and cross-match
        native_filter = Candidate.applied_job_id == job_id
        cross_filter = CrossJobMatch.matched_job_id == job_id
        
        if start_date:
            native_filter = and_(native_filter, Candidate.created_at >= start_date)
            cross_filter = and_(cross_filter, CrossJobMatch.created_at >= start_date)
        if end_date:
            native_filter = and_(native_filter, Candidate.created_at <= end_date)
            cross_filter = and_(cross_filter, CrossJobMatch.created_at <= end_date)

        # Subquery to get unique candidate identifiers (email) and their strongest source of screening info
        # Prioritize native (resumes) over cross matches
        stmt = (
            select(
                func.coalesce(Candidate.email, func.cast(Candidate.id, Text)).label("unique_id"),
                case(
                    (Candidate.applied_job_id == job_id, Resume.pass_fail),
                    else_=case(
                        (CrossJobMatch.match_score >= threshold, "passed"),
                        (CrossJobMatch.match_score < threshold, "failed"),
                        else_="pending"
                    )
                ).label("final_pass_fail")
            )
            .distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text)))
            .outerjoin(Resume, Resume.candidate_id == Candidate.id)
            .outerjoin(CrossJobMatch, CrossJobMatch.candidate_id == Candidate.id)
            .where(
                and_(
                    or_(
                        native_filter,
                        cross_filter
                    ),
                    Resume.parsed.is_(True)
                )
            )
            # Order by is_native to ensure DISTINCT picks native record if available
            .order_by(
                func.coalesce(Candidate.email, func.cast(Candidate.id, Text)),
                case((Candidate.applied_job_id == job_id, 0), else_=1)
            )
        )

        rows = await db.execute(stmt)
        counts: dict[str, int] = {"passed": 0, "failed": 0, "pending": 0}
        for _, pf in rows.all():
            if not pf:
                counts["pending"] += 1
            else:
                normalized = pf.lower().strip()
                if normalized in ("pass", "passed"):
                    counts["passed"] += 1
                elif normalized in ("fail", "failed"):
                    counts["failed"] += 1
                else:
                    counts["pending"] += 1

        return JobResultStats(
            passed=counts["passed"],
            failed=counts["failed"],
            pending=counts["pending"],
        )

    async def _get_location_stats(
        self, db: AsyncSession, job_id: uuid.UUID, start_date: datetime | None, end_date: datetime | None
    ) -> dict[str, int]:
        """
        Count unique candidates per location for this job.
        Includes cross-matches. Deduplicates by email.
        """
        # Filters for native and cross-match
        native_filter = Candidate.applied_job_id == job_id
        cross_filter = CrossJobMatch.matched_job_id == job_id
        
        if start_date:
            native_filter = and_(native_filter, Candidate.created_at >= start_date)
            cross_filter = and_(cross_filter, CrossJobMatch.created_at >= start_date)
        if end_date:
            native_filter = and_(native_filter, Candidate.created_at <= end_date)
            cross_filter = and_(cross_filter, CrossJobMatch.created_at <= end_date)

        stmt = (
            select(Location.name, func.count(func.distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text)))))
            .join(Candidate, Location.id == Candidate.location_id)
            .where(
                or_(
                    native_filter,
                    Candidate.id.in_(
                        select(CrossJobMatch.candidate_id).where(cross_filter)
                    )
                )
            )
            .group_by(Location.name)
        )
        rows = await db.execute(stmt)
        location_counts: dict[str, int] = {row[0]: row[1] for row in rows.all()}

        # Removed "Unknown" (NULL) location count per user request.
        # Only candidates with an identified location appear in these stats.
        return location_counts

    async def _get_stage_stats(
        self, db: AsyncSession, job_id: uuid.UUID, start_date: datetime | None, end_date: datetime | None
    ) -> dict[str, int]:
        """
        Count how many unique candidates are in each stage for this job.
        Deduplicates by email.
        """
        # 1. Subquery to find the "current" stage record ID for each candidate in this job.
        # Logic:
        #   - We prefer the highest order non-pending stage.
        #   - If all are pending, we prefer the lowest order pending stage (the first stage).
        
        # Filters for native and cross-match
        native_filter = Candidate.applied_job_id == job_id
        cross_filter = CrossJobMatch.matched_job_id == job_id
        
        if start_date:
            native_filter = and_(native_filter, Candidate.created_at >= start_date)
            cross_filter = and_(cross_filter, CrossJobMatch.created_at >= start_date)
        if end_date:
            native_filter = and_(native_filter, Candidate.created_at <= end_date)
            cross_filter = and_(cross_filter, CrossJobMatch.created_at <= end_date)

        # Deduplication subquery: Map each unique person (email) to their latest application record in this job context
        unique_candidates_subq = (
            select(
                func.coalesce(Candidate.email, func.cast(Candidate.id, Text)).label("unique_id"),
                Candidate.id.label("representative_candidate_id")
            )
            .distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text)))
            .outerjoin(CrossJobMatch, CrossJobMatch.candidate_id == Candidate.id)
            .where(
                or_(
                    native_filter,
                    cross_filter
                )
            )
            .order_by(
                func.coalesce(Candidate.email, func.cast(Candidate.id, Text)),
                case((Candidate.applied_job_id == job_id, 0), else_=1), # Prefer native record
                Candidate.created_at.desc()
            )
            .subquery()
        )

        # 2. Subquery to find the "best order" for these representative candidate records
        best_order_subq = (
            select(
                CandidateStage.candidate_id,
                func.coalesce(
                    func.max(
                        case(
                            (
                                CandidateStage.status != "pending",
                                JobStageConfig.stage_order,
                            ),
                            else_=None,
                        )
                    ),
                ).label("best_order"),
            )
            .select_from(CandidateStage)
            .join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
            .where(JobStageConfig.job_id == job_id)
            .where(CandidateStage.candidate_id.in_(select(unique_candidates_subq.c.representative_candidate_id)))
            .group_by(CandidateStage.candidate_id)
            .subquery()
        )

        # 2. Fetch the stage records
        stmt = (
            select(StageTemplate.name, CandidateStage.status)
            .select_from(CandidateStage)
            .join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
            .join(StageTemplate, JobStageConfig.template_id == StageTemplate.id)
            .join(
                best_order_subq,
                and_(
                    best_order_subq.c.candidate_id == CandidateStage.candidate_id,
                    best_order_subq.c.best_order == JobStageConfig.stage_order,
                ),
            )
            .where(JobStageConfig.job_id == job_id)
            .order_by(CandidateStage.candidate_id, CandidateStage.started_at.desc())
        )

        rows = await db.execute(stmt)

        # 3. Build the flat result dictionary
        # Initialize all stages with 0 for both active and completed
        all_stages_res = await db.execute(
            select(StageTemplate.name)
            .select_from(JobStageConfig)
            .join(StageTemplate, JobStageConfig.template_id == StageTemplate.id)
            .where(JobStageConfig.job_id == job_id)
            .order_by(JobStageConfig.stage_order)
        )

        final_stats: dict[str, int] = {}
        for name in all_stages_res.scalars().all():
            final_stats[name] = 0

        # 4. Fill with actual counts (only for current active/pending candidates)
        for name, status in rows.all():
            if status in ("pending", "active"):
                if name in final_stats:
                    final_stats[name] += 1
                else:
                    final_stats[name] = 1  # Fallback for unexpected stages
        return final_stats

    async def _get_hr_decision_stats(
        self, db: AsyncSession, job_id: uuid.UUID, start_date: datetime | None, end_date: datetime | None
    ) -> JobHRDecisionStats:
        """
        Compute unique HR decision breakdown for this job.
        Deduplicates by email.
        """
        # Filters for native and cross-match
        from app.v1.db.models.cross_job_matches import CrossJobMatch
        native_filter = Candidate.applied_job_id == job_id
        cross_filter = CrossJobMatch.matched_job_id == job_id
        
        if start_date:
            native_filter = and_(native_filter, Candidate.created_at >= start_date)
            cross_filter = and_(cross_filter, CrossJobMatch.created_at >= start_date)
        if end_date:
            native_filter = and_(native_filter, Candidate.created_at <= end_date)
            cross_filter = and_(cross_filter, CrossJobMatch.created_at <= end_date)

        # Total unique candidates in pool (deduplicated by email)
        total_unique_stmt = select(
            func.count(func.distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text))))
        ).join(Resume, Resume.candidate_id == Candidate.id).where(
            and_(
                or_(
                    native_filter,
                    Candidate.id.in_(
                        select(CrossJobMatch.candidate_id).where(cross_filter)
                    )
                ),
                Resume.parsed.is_(True)
            )
        )
        total_candidates = await db.scalar(total_unique_stmt) or 0

        # Latest decision per unique person in this job
        subq = (
            select(
                func.coalesce(Candidate.email, func.cast(Candidate.id, Text)).label("person_id"),
                func.lower(HrDecision.decision).label("decision"),
                func.row_number()
                .over(
                    partition_by=func.coalesce(Candidate.email, func.cast(Candidate.id, Text)),
                    order_by=HrDecision.decided_at.desc(),
                )
                .label("rn"),
            )
            .join(HrDecision, HrDecision.candidate_id == Candidate.id)
            .where(
                or_(
                    HrDecision.job_id == job_id,
                    and_(
                        HrDecision.job_id.is_(None),
                        or_(
                            Candidate.applied_job_id == job_id,
                            Candidate.id.in_(
                                select(CrossJobMatch.candidate_id).where(CrossJobMatch.matched_job_id == job_id)
                            )
                        )
                    )
                )
            )
            .where(
                or_(
                    native_filter,
                    Candidate.id.in_(
                        select(CrossJobMatch.candidate_id).where(cross_filter)
                    )
                )
            )
        ).subquery()

        decision_rows = await db.execute(
            select(subq.c.decision, func.count().label("cnt"))
            .where(subq.c.rn == 1)
            .group_by(subq.c.decision)
        )
        
        counts: dict[str, int] = {}
        for row in decision_rows.all():
            if row.decision:
                d_key = str(row.decision).lower().strip().replace(" ", "") 
                counts[d_key] = counts.get(d_key, 0) + row.cnt

        decided_total = sum(counts.values())

        return JobHRDecisionStats(
            total_candidates=total_candidates,
            passed=counts.get("pass", 0) or counts.get("passed", 0),
            failed=counts.get("fail", 0) or counts.get("failed", 0),
            maybe=counts.get("maybe", 0),
            pending=max(total_candidates - decided_total, 0),
            undecidedCount=max(total_candidates - decided_total, 0)
        )

    async def _get_priority_timeline(
        self, db: AsyncSession, job_id: uuid.UUID
    ) -> JobPriorityTimeline | None:
        """
        Build priority timeline data for graph display.
        Returns None if the job has no priority assigned.

        Provides:
          - Progress metrics (days_total, days_elapsed, days_remaining, progress_pct)
          - Per-day candidate arrivals within priority period (daily_candidates)
        """
        from app.v1.db.models.jobs import Job
        from app.v1.db.models.job_priorities import JobPriority

        job = await db.get(Job, job_id)
        if not job or not job.priority_id:
            return None

        priority = await db.get(JobPriority, job.priority_id)
        if not priority:
            return None

        today = datetime.now(timezone.utc).date()
        start_dt = job.priority_start_date.date() if job.priority_start_date else None
        end_dt = job.priority_end_date.date() if job.priority_end_date else None

        # Compute days stats
        days_total = None
        days_elapsed = None
        days_remaining = None
        progress_pct = None
        status = "not_set"

        if start_dt and end_dt:
            days_total = (end_dt - start_dt).days
            if today < start_dt:
                status = "not_started"
                days_elapsed = 0
                days_remaining = (end_dt - today).days
                progress_pct = 0.0
            elif today > end_dt:
                status = "expired"
                days_elapsed = days_total
                days_remaining = 0
                progress_pct = 100.0
            else:
                status = "active"
                days_elapsed = (today - start_dt).days
                days_remaining = (end_dt - today).days
                progress_pct = round((days_elapsed / days_total) * 100, 1) if days_total > 0 else 0.0

        return JobPriorityTimeline(
            name=priority.name,
            start_date=str(start_dt) if start_dt else None,
            due_date=str(end_dt) if end_dt else None,
            days_total=days_total,
            days_elapsed=days_elapsed,
            days_remaining=days_remaining,
            progress_pct=progress_pct,
            status=status,
        )

    async def _get_stage_details(
        self,
        db: AsyncSession,
        job_id: uuid.UUID,
        start_date: datetime | None,
        end_date: datetime | None,
    ) -> dict[str, JobStageDetails]:
        """
        Provides a stage-wise breakdown of HR decisions and AI results.
        """
        # 1. Fetch all stages for this job
        stage_configs_res = await db.execute(
            select(JobStageConfig)
            .select_from(JobStageConfig)
            .join(StageTemplate, JobStageConfig.template_id == StageTemplate.id)
            .where(JobStageConfig.job_id == job_id)
            .options(selectinload(JobStageConfig.template))
            .order_by(JobStageConfig.stage_order)
        )
        stage_configs = stage_configs_res.scalars().all()

        stage_details: dict[str, JobStageDetails] = {}

        for config in stage_configs:
            stage_name = config.template.name
            is_resume_screening = (config.stage_order == 1 or stage_name == "Resume Screening")
            
            # HR Decisions for this stage
            hr_stmt = (
                select(func.lower(HrDecision.decision), func.count())
                .where(HrDecision.job_id == job_id)
                .group_by(func.lower(HrDecision.decision))
            )
            
            if is_resume_screening:
                # Include both explicit Stage 0 and NULL stage_config_id (Legacy/Default)
                hr_stmt = hr_stmt.where(
                    or_(
                        HrDecision.stage_config_id == config.id,
                        HrDecision.stage_config_id.is_(None)
                    )
                )
            else:
                hr_stmt = hr_stmt.where(HrDecision.stage_config_id == config.id)
                
            hr_rows = await db.execute(hr_stmt)
            hr_counts = {str(d).lower().strip(): cnt for d, cnt in hr_rows.all() if d}

            # AI Results for this stage
            ai_counts: dict[str, int] = {"passed": 0, "failed": 0, "pending": 0}
            
            if is_resume_screening:
                # Stage 0 (Resume Screening) - Use same robust logic as _get_result_stats
                from app.v1.db.models.jobs import Job
                job = await db.get(Job, job_id)
                threshold = float(job.passing_threshold) if job and job.passing_threshold else 70.0

                # Filters for native and cross-match
                native_filter = Candidate.applied_job_id == job_id
                cross_filter = CrossJobMatch.matched_job_id == job_id

                subq = (
                    select(
                        func.coalesce(Candidate.email, func.cast(Candidate.id, Text)).label("unique_id"),
                        case(
                            (Candidate.applied_job_id == job_id, Resume.pass_fail),
                            else_=case(
                                (CrossJobMatch.match_score >= threshold, "passed"),
                                (CrossJobMatch.match_score < threshold, "failed"),
                                else_="pending"
                            )
                        ).label("final_pass_fail")
                    )
                    .distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text)))
                    .outerjoin(Resume, Resume.candidate_id == Candidate.id)
                    .outerjoin(CrossJobMatch, CrossJobMatch.candidate_id == Candidate.id)
                    .where(or_(native_filter, cross_filter))
                    .subquery()
                )

                ai_stmt = select(subq.c.final_pass_fail, func.count()).group_by(subq.c.final_pass_fail)
                ai_rows = await db.execute(ai_stmt)
                for pf, cnt in ai_rows.all():
                    if not pf:
                        ai_counts["pending"] += cnt
                    else:
                        normalized = pf.lower().strip()
                        if normalized in ("pass", "passed"):
                            ai_counts["passed"] += cnt
                        elif normalized in ("fail", "failed"):
                            ai_counts["failed"] += cnt
                        else:
                            ai_counts["pending"] += cnt
            else:
                # Interview Rounds (Evaluations)
                ai_stmt = (
                    select(func.lower(Evaluation.result), func.count())
                    .join(CandidateStage, Evaluation.candidate_stage_id == CandidateStage.id)
                    .where(CandidateStage.job_stage_id == config.id)
                    .group_by(func.lower(Evaluation.result))
                )
                ai_rows = await db.execute(ai_stmt)
                for res, cnt in ai_rows.all():
                    if res == "pass":
                        ai_counts["passed"] += cnt
                    elif res == "fail":
                        ai_counts["failed"] += cnt
                    else:
                        ai_counts["pending"] += cnt

            stage_details[stage_name] = JobStageDetails(
                hr_decisions=hr_counts,
                ai_results=ai_counts
            )

        return stage_details


# Singleton instance
job_stats_service = JobStatsService()
