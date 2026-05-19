import uuid
import logging
from datetime import datetime, timedelta
from typing import Any

from app.v1.db.models.jobs import Job
from app.v1.repository.job_repository import job_repository
from app.v1.schemas.job import (
    JobCreate,
    JobStatusUpdate,
    JobUpdate,
    JobRead,
    JobsListRead,
    JobActivityHistoryResponse,
    JobActivitySession,
    JobTitleRead,
    JobTitlesListRead,
)
from app.v1.repository.user_repository import user_repository
from app.v1.services.admin.audit_service import audit_service
from app.v1.services.admin.department_service import department_service
from app.v1.services.admin.skill_service import skill_service
from app.v1.services.user_service import user_service
from app.v1.services.admin.job_priority_service import job_priority_service
from app.v1.services.stage.enrichment import enrich_stage_configs
from fastapi import HTTPException, status
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.v1.core.cache import cache
from app.v1.db.models.audit_logs import AuditLog
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.cross_job_matches import CrossJobMatch
from app.v1.db.models.hr_decisions import HrDecision
from app.v1.db.models.resumes import Resume

logger = logging.getLogger(__name__)


class JobAdminService:
    """
    Service for admin-level job management operations.
    """

    async def get_all_jobs(
        self, 
        db: AsyncSession, 
        skip: int = 0, 
        limit: int = 100, 
        query: str | None = None,
        status: list[bool] | None = None,
        department_ids: list[uuid.UUID] | None = None,
        priority_ids: list[uuid.UUID] | None = None,
        position_ids: list[uuid.UUID] | None = None,
    ) -> JobsListRead:
        """Get all jobs with pagination and global dashboard summaries."""
        # 0. Cache lookup
        cache_key = f"jobs:list:{skip}:{limit}:{query or 'none'}:{sorted(status) if status else 'all'}:{department_ids}:{priority_ids}:{position_ids}"
        cached = await cache.get(cache_key)
        if cached:
            try:
                return JobsListRead.model_validate(cached)
            except Exception:
                pass

        result = await job_repository.get_multi(
            db=db, 
            skip=skip, 
            limit=limit, 
            query=query, 
            status=status, 
            department_ids=department_ids,
            priority_ids=priority_ids,
            position_ids=position_ids
        )

        from app.v1.services.hr_decision_service import hr_decision_service

        job_reads = []
        for job in result["data"]:
            if job.stages:
                await enrich_stage_configs(db, job.stages)
            job_read = JobRead.model_validate(job)
            # Add per-job automated screening summary
            job_read.automated_screening_summary = (
                await hr_decision_service.get_job_screening_summary(db, job.id)
            )
            # Add per-job decision summary (Attaching for dashboard parity)
            decision_summary = await hr_decision_service.get_job_decision_summary(db, job.id)
            job_read.decision_summary = decision_summary.model_dump()

            # Add total and current session counts (Enabled session history for list view)
            stats = await self._calculate_job_activity_stats(db, job.id, include_sessions=True)
            job_read.total_candidates = stats["total_candidates"]
            job_read.current_session_candidates = stats["current_session_count"]
            job_read.activity_sessions = stats["sessions"]
            
            job_reads.append(job_read)

        res = JobsListRead(
            data=job_reads,
            total=result["total"],
            global_decision_summary=await hr_decision_service.get_global_decision_summary(
                db
            ),
            global_screening_summary=await hr_decision_service.get_global_screening_summary(
                db
            ),
        )

        # Cache the result (5 minutes)
        await cache.set(cache_key, res.model_dump(), ttl=300)

        return res

    async def search_jobs(
        self, db: AsyncSession, query: str, skip: int = 0, limit: int = 100
    ) -> JobsListRead:
        """Search jobs with global and per-job screening summaries."""
        cache_key = f"jobs:search:{skip}:{limit}:{query}"
        cached = await cache.get(cache_key)
        if cached:
            try:
                return JobsListRead.model_validate(cached)
            except Exception:
                pass

        result = await job_repository.search(db=db, query=query, skip=skip, limit=limit)

        from app.v1.services.hr_decision_service import hr_decision_service

        job_reads = []
        for job in result["data"]:
            if job.stages:
                await enrich_stage_configs(db, job.stages)
            job_read = JobRead.model_validate(job)
            # Add per-job automated screening summary
            job_read.automated_screening_summary = (
                await hr_decision_service.get_job_screening_summary(db, job.id)
            )
            # Add per-job decision summary (Attaching for search results parity)
            decision_summary = await hr_decision_service.get_job_decision_summary(db, job.id)
            job_read.decision_summary = decision_summary.model_dump()

            # Add total and current session counts (Enabled session history for search view)
            stats = await self._calculate_job_activity_stats(db, job.id, include_sessions=True)
            job_read.total_candidates = stats["total_candidates"]
            job_read.current_session_candidates = stats["current_session_count"]
            job_read.activity_sessions = stats["sessions"]

            job_reads.append(job_read)

        return JobsListRead(
            data=job_reads,
            total=result["total"],
            global_decision_summary=await hr_decision_service.get_global_decision_summary(
                db
            ),
            global_screening_summary=await hr_decision_service.get_global_screening_summary(
                db
            ),
        )
    
    async def get_job_titles(self, db: AsyncSession, query: str | None = None) -> JobTitlesListRead:
        """Retrieve only IDs and titles for all jobs."""
        titles = await job_repository.get_titles(db, query=query)
        return JobTitlesListRead(data=[JobTitleRead(**t) for t in titles])

    async def get_job_by_id(self, db: AsyncSession, job_id: uuid.UUID) -> JobRead:
        """Get a job by ID."""
        job = await job_repository.get(db=db, id=job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found.",
            )
        if job.stages:
            await enrich_stage_configs(db, job.stages)
        job_read = JobRead.model_validate(job)
        # Populate activity history for detailed view
        stats = await self._calculate_job_activity_stats(db, job_id, include_sessions=True)
        job_read.total_candidates = stats["total_candidates"]
        job_read.current_session_candidates = stats["current_session_count"]
        job_read.activity_sessions = stats["sessions"]
        return job_read

    async def get_job_version(self, db: AsyncSession, version_id: uuid.UUID) -> Any:
        """Get a specific job version snapshot by its unique ID."""
        version = await job_repository.get_version(db=db, id=version_id)
        if not version:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job version not found.",
            )
        return version

    async def create_job(
        self, db: AsyncSession, admin_user_id: uuid.UUID, job_in: JobCreate
    ) -> JobRead:
        """Create a new job."""
        # Validate department existence if provided
        if job_in.department_id:
            await department_service.get_department_by_id(db, job_in.department_id)

        # Validate skills existence if provided
        if job_in.skill_ids:
            for skill_id in job_in.skill_ids:
                await skill_service.get_skill_by_id(db, skill_id)

        # Validate title uniqueness (case-insensitive)
        from sqlalchemy import func, select
        existing_job_stmt = select(Job.id).where(func.lower(Job.title) == func.lower(job_in.title))
        if await db.scalar(existing_job_stmt):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Job with title '{job_in.title}' already exists.",
            )

        # Handle priority dates calculation
        if job_in.priority_id:
            if not job_in.priority_start_date:
                job_in.priority_start_date = datetime.now()
            
            if not job_in.priority_end_date:
                priority = await job_priority_service.get_priority_by_id(db, job_in.priority_id)
                if priority:
                    job_in.priority_end_date = job_in.priority_start_date + timedelta(days=priority.duration_days)

        job = await job_repository.create(
            db=db, object=job_in, created_by=admin_user_id
        )

        # Setup stages for the new job
        from app.v1.services.stage_service import stage_service
        from app.v1.schemas.job_stage import JobStageConfigCreate

        try:
            if job_in.stages is None:
                # No stages provided → auto-setup the 3 default stages
                await stage_service.setup_default_stages(db=db, job_id=job.id)
                logger.info(f"Default stages auto-created for new job: {job.id}")
            elif len(job_in.stages) > 0:
                # Custom stages provided → create exactly those
                custom_stages = [
                    JobStageConfigCreate(
                        template_id=s.template_id,
                        stage_order=s.stage_order,
                        is_mandatory=s.is_mandatory,
                        config=s.config,
                    )
                    for s in job_in.stages
                ]
                await stage_service.bulk_setup_job_stages(db=db, job_id=job.id, stages_in=custom_stages)
                logger.info(f"Custom {len(custom_stages)} stages created for new job: {job.id}")
            # else: stages=[] → no stages created (intentional)
        except Exception as e:
            logger.warning(f"Could not setup stages for job {job.id}: {e}")

        # Flush and expire to ensure next fetch sees the stages
        job_id = job.id
        await db.flush()
        db.expire_all()

        # Re-fetch the job with all stages and templates fully loaded
        job = await self.get_job_by_id(db, job_id)

        # Invalidate job board and search caches
        from app.v1.core.cache import cache
        await cache.clear(pattern="jobs:list:*")
        await cache.clear(pattern="jobs:search:*")

        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="create_job",
            target_type="job",
            target_id=job.id,
            details={
                "job_id": str(job.id),
                "title": job.title,
                "jd_text": job.jd_text,
                "department_id": str(job.department_id),
                "priority_id": str(job.priority_id),
                "position_id": str(job.position_id),
                "skill_ids": [str(s.id) for s in job.skills],
                "stage_ids": [str(s.id) for s in job.stages],
                "is_active": job.is_active,
                "created_at": job.created_at.isoformat() if job.created_at else None
            },
        )

        # Trigger background task to match all existing resumes to this new job
        from app.v1.services.admin.job_tasks import match_all_resumes_to_job_task
        logger.info(f"Triggering mass matching task for new job: {job.id}")
        match_all_resumes_to_job_task.delay(str(job.id))

        # Invalidate job board and search caches
        from app.v1.core.cache import cache
        await cache.clear(pattern="jobs:list:*")
        await cache.clear(pattern="jobs:search:*")

        return JobRead.model_validate(job)

    async def update_job(
        self,
        db: AsyncSession,
        admin_user_id: uuid.UUID,
        job_id: uuid.UUID,
        job_update: JobUpdate,
        background_tasks=None,
    ) -> JobRead:
        # Update a job. Auto-triggers mass refresh if custom_extraction_fields changed.
        await self.get_job_by_id(db=db, job_id=job_id)

        # Filter out invalid department_id if provided
        if job_update.department_id:
            try:
                await department_service.get_department_by_id(
                    db, job_update.department_id
                )
            except HTTPException:
                # If department doesn't exist, don't update it (keep existing)
                job_update.department_id = None

        # Filter out invalid skill_ids if provided
        if job_update.skill_ids:
            valid_skill_ids = []
            for s_id in job_update.skill_ids:
                try:
                    await skill_service.get_skill_by_id(db, s_id)
                    valid_skill_ids.append(s_id)
                except HTTPException:
                    # Skip invalid skill IDs (like the 3fa85f64 dummy placeholder)
                    continue
            job_update.skill_ids = valid_skill_ids

        # Validate title uniqueness (case-insensitive) if title is being changed
        if job_update.title:
            from sqlalchemy import func, select
            # Get current job to see if title is actually changing
            current_job = await self.get_job_by_id(db, job_id)
            if job_update.title.lower() != current_job.title.lower():
                existing_job_stmt = select(Job.id).where(func.lower(Job.title) == func.lower(job_update.title))
                if await db.scalar(existing_job_stmt):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Job with title '{job_update.title}' already exists.",
                    )

        # Handle priority dates calculation on update
        if job_update.priority_id:
            # If priority changed or start date is not set, set it
            if not job_update.priority_start_date:
                job_update.priority_start_date = datetime.now()
            
            if not job_update.priority_end_date:
                priority = await job_priority_service.get_priority_by_id(db, job_update.priority_id)
                if priority:
                    job_update.priority_end_date = job_update.priority_start_date + timedelta(days=priority.duration_days)

        updated_job = await job_repository.update(db=db, id=job_id, object=job_update)
        
        # Handle stages update if provided (same logic as create_job)
        if job_update.stages is not None:
            from app.v1.services.stage_service import stage_service
            from app.v1.schemas.job_stage import JobStageConfigCreate
            
            try:
                custom_stages = [
                    JobStageConfigCreate(
                        template_id=s.template_id,
                        stage_order=s.stage_order,
                        is_mandatory=s.is_mandatory,
                        config=s.config,
                    )
                    for s in job_update.stages
                ]
                await stage_service.bulk_setup_job_stages(db=db, job_id=job_id, stages_in=custom_stages)
                logger.info(f"Stages updated for job: {job_id}")
            except Exception as e:
                logger.warning(f"Could not update stages for job {job_id}: {e}")

        # Flush and expire to ensure next fetch sees the stages
        # job_id is already passed as an argument to this function
        await db.flush()
        db.expire_all()

        # Re-fetch the job with all stages and templates fully loaded
        updated_job = await self.get_job_by_id(db, job_id)

        updated_fields_map = job_update.model_dump(exclude_unset=True)
        
        # Log general update with values
        log_details = {
            "job_id": str(job_id),
            "updated_fields": list(updated_fields_map.keys()),
        }
        # Add specific values for important fields to make audit logs readable
        for field in ["priority_id", "title", "department_id", "position_id", "is_active"]:
            if field in updated_fields_map:
                log_details[field] = str(updated_fields_map[field])

        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="update_job",
            target_type="job",
            target_id=job_id,
            details=log_details,
        )

        # CRITICAL: If is_active was changed, log a specific update_job_status action
        # so that the session reconstruction logic (which looks for this action) picks it up.
        if "is_active" in updated_fields_map:
            await audit_service.log_action(
                db=db,
                user_id=admin_user_id,
                action="update_job_status",
                target_type="job",
                target_id=job_id,
                details={"is_active": updated_fields_map["is_active"]},
            )

        updated_fields = updated_fields_map # Maintain compatibility with existing variable name below
        if background_tasks is not None:
            from app.v1.core.cache import cache
            from app.v1.services.resume_upload.background import BackgroundProcessor
            from app.v1.services.resume_upload.processor import ResumeProcessor

            # Clear cache for job embedding if JD or Title changed
            if "jd_text" in updated_fields or "title" in updated_fields:
                await cache.delete(f"job_embedding:{job_id}_v{updated_job.version}")

            # Only trigger mass refresh for major changes if desired, 
            # but clearing the cache ensures the NEXT manual re-analysis is fresh.
            if "custom_extraction_fields" in updated_fields or "jd_text" in updated_fields:
                bg_processor = BackgroundProcessor(ResumeProcessor())
                # Use Celery for mass refresh to avoid blocking the main server threads with heavy LLM work
                bg_processor.schedule_mass_refresh(
                    job_id=job_id,
                    full_refresh=("jd_text" in updated_fields)
                )

        # Invalidate job board and search caches
        from app.v1.core.cache import cache
        await cache.clear(pattern="jobs:list:*")
        await cache.clear(pattern="jobs:search:*")

        return JobRead.model_validate(updated_job)

    async def update_job_status(
        self,
        db: AsyncSession,
        admin_user_id: uuid.UUID,
        job_id: uuid.UUID,
        status_in: JobStatusUpdate,
    ) -> JobRead:
        """Update job active status without incrementing version."""
        # 1. Verify existence
        await self.get_job_by_id(db=db, job_id=job_id)

        # 2. Update status via repository
        # JobRepository.update logic correctly identifies is_active as a non-version-worthy change.
        job_update = JobUpdate(is_active=status_in.is_active)
        updated_job = await job_repository.update(db=db, id=job_id, object=job_update)

        # 3. Log Audit
        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="update_job_status",
            target_type="job",
            target_id=job_id,
            details={
                "job_id": str(job_id),
                "is_active": status_in.is_active
            },
        )

        # Invalidate job board and search caches
        from app.v1.core.cache import cache
        await cache.clear(pattern="jobs:list:*")
        await cache.clear(pattern="jobs:search:*")

        return JobRead.model_validate(updated_job)


    async def delete_job(
        self, db: AsyncSession, admin_user_id: uuid.UUID, job_id: uuid.UUID
    ) -> None:
        """Force-delete a job only when inactive (hr_admin and superadmin only)."""
        current_user = await user_service.get_user_by_id(db=db, user_id=admin_user_id)
        role_name = (current_user.role_name or "").lower()
        is_super_admin = "admin:all" in current_user.permissions
        allowed_roles = {"hr_admin", "superadmin", "super_admin"}
        if not is_super_admin and role_name not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only HR Admin or Super Admin can force delete jobs.",
            )

        job = await self.get_job_by_id(db=db, job_id=job_id)
        if job.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please deactivate the job before deleting it.",
            )

        # Capture details before deletion (while object is still in DB)
        job_title = job.title
        job_is_active = job.is_active
        
        # Get admin user role for context
        admin_user = await user_repository.get_by_id(db, admin_user_id)
        admin_role = admin_user.role_name if admin_user else "unknown"

        # Now perform the actual deletion
        await job_repository.force_delete(db=db, id=job_id)

        # Invalidate job board and search caches
        from app.v1.core.cache import cache
        await cache.clear(pattern="jobs:list:*")
        await cache.clear(pattern="jobs:search:*")

        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="force_delete_job",
            target_type="job",
            target_id=job_id,
            details={
                "job_id": str(job_id),
                "title": job_title,
                "is_active": job_is_active,
                "deleted_by_role": admin_role
            },
        )


    async def get_job_activity_history(
        self, db: AsyncSession, job_id: uuid.UUID
    ) -> JobActivityHistoryResponse:
        """
        Reconstruct job activation sessions and count candidates for each.
        """
        stats = await self._calculate_job_activity_stats(db, job_id, include_sessions=True)
        return JobActivityHistoryResponse(
            job_id=job_id,
            total_candidates=stats["total_candidates"],
            sessions=stats["sessions"],
        )

    async def _calculate_job_activity_stats(
        self, db: AsyncSession, job_id: uuid.UUID, include_sessions: bool = True
    ) -> dict[str, Any]:
        """
        Helper to calculate total candidates and session breakdown for a job.
        
        Returns:
            A dictionary with 'total_candidates', 'current_session_count', 
            and 'sessions' (list of JobActivitySession).
        """
        from sqlalchemy import select, and_, func, or_, case, Text
        from app.v1.db.models.audit_logs import AuditLog
        from app.v1.db.models.candidates import Candidate
        from app.v1.db.models.cross_job_matches import CrossJobMatch

        # 1. Verify job existence and get creation time
        job = await job_repository.get(db=db, id=job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found.",
            )

        # 2. Get total unique candidates for this job (Native OR Cross, deduplicated by email)
        total_unique_stmt = select(
            func.count(func.distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text))))
        ).join(Resume, Resume.candidate_id == Candidate.id).where(
            and_(
                Resume.parsed.is_(True),
                or_(
                    Candidate.applied_job_id == job_id,
                    Candidate.id.in_(
                        select(CrossJobMatch.candidate_id).where(CrossJobMatch.matched_job_id == job_id)
                    )
                )
            )
        )
        total_candidates = await db.scalar(total_unique_stmt) or 0

        # 3. Get status update audit logs
        stmt = (
            select(AuditLog)
            .where(
                and_(
                    AuditLog.target_id == job_id,
                    AuditLog.target_type == "job",
                    AuditLog.action == "update_job_status",
                )
            )
            .order_by(AuditLog.created_at.asc())
        )
        result = await db.execute(stmt)
        logs = result.scalars().all()

        # 4. Reconstruct sessions
        sessions_data = []
        current_start = job.created_at
        last_state = True  # Assuming job starts active
        session_counter = 1

        for log in logs:
            is_active_val = log.details.get("is_active")
            if is_active_val is None:
                continue

            if last_state and not is_active_val:
                # Session closed
                sessions_data.append(
                    {
                        "session_id": session_counter,
                        "start_date": current_start,
                        "end_date": log.created_at,
                        "is_current": False,
                    }
                )
                session_counter += 1
                last_state = False
            elif not last_state and is_active_val:
                # New session starts
                current_start = log.created_at
                last_state = True

        # Current session (if still active)
        if last_state:
            sessions_data.append(
                {
                    "session_id": session_counter,
                    "start_date": current_start,
                    "end_date": None,
                    "is_current": True,
                }
            )

        # 5. Calculate counts for sessions
        final_sessions = []
        current_session_count = 0
        from app.v1.schemas.job import JobActivitySession
        
        for s in sessions_data:
            # Skip candidate counting for session if we only need the current session count 
            # and this is not the current one.
            if not include_sessions and not s["is_current"]:
                continue

            # Build conditions dynamically to handle None end_dates
            # Note: We filter candidates who were created/matched during this session's window
            session_candidate_ids_stmt = select(Candidate.id).join(Resume, Resume.candidate_id == Candidate.id).where(
                and_(
                    Resume.parsed.is_(True),
                    or_(
                        and_(Candidate.applied_job_id == job_id, Candidate.created_at >= s["start_date"], Candidate.created_at <= (s["end_date"] if s["end_date"] else func.now())),
                        Candidate.id.in_(
                            select(CrossJobMatch.candidate_id).where(
                                and_(CrossJobMatch.matched_job_id == job_id, CrossJobMatch.created_at >= s["start_date"], CrossJobMatch.created_at <= (s["end_date"] if s["end_date"] else func.now()))
                            )
                        )
                    )
                )
            )

            # Get latest decision per unique person (deduplicated by email) for this job
            subq = (
                select(
                    func.coalesce(Candidate.email, func.cast(Candidate.id, Text)).label("person_id"),
                    HrDecision.decision,
                    func.row_number()
                    .over(
                        partition_by=func.coalesce(Candidate.email, func.cast(Candidate.id, Text)),
                        order_by=HrDecision.decided_at.desc(),
                    )
                    .label("rn"),
                )
                .join(Candidate, HrDecision.candidate_id == Candidate.id)
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
                .where(HrDecision.candidate_id.in_(session_candidate_ids_stmt))
            ).subquery()

            latest_decisions_stmt = select(subq.c.decision, func.count().label("cnt")).where(subq.c.rn == 1).group_by(subq.c.decision)
            dec_result = await db.execute(latest_decisions_stmt)
            dec_rows = dec_result.fetchall()
            dec_counts = {row.decision.lower(): row.cnt for row in dec_rows}

            # Total unique count for the session
            session_unique_stmt = select(
                func.count(func.distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text))))
            ).where(Candidate.id.in_(session_candidate_ids_stmt))
            
            count_val = await db.scalar(session_unique_stmt) or 0
            
            s["candidate_count"] = count_val
            s["passed_count"] = dec_counts.get("pass", 0)
            s["failed_count"] = dec_counts.get("fail", 0)
            
            # Pending is total unique minus those with final decisions (pass/fail)
            # We use the total unique count for the session as the base
            decided_total = s["passed_count"] + s["failed_count"] + dec_counts.get("may be", 0)
            s["pending_count"] = max(0, count_val - decided_total) + dec_counts.get("may be", 0)
            
            if s["is_current"]:
                current_session_count = count_val
            
            if include_sessions:
                final_sessions.append(JobActivitySession(**s))

        return {
            "total_candidates": total_candidates,
            "current_session_count": current_session_count,
            "sessions": final_sessions,
        }


job_admin_service = JobAdminService()
