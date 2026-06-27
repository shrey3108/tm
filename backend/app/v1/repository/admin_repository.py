"""
Admin Repository Module.

Provides data access layer for admin operations including user management,
role management, permission management, audit logs, and analytics reporting.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, desc, func, or_, select, case, Text
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.models.audit_logs import AuditLog
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.files import File
from app.v1.db.models.jobs import Job
from app.v1.db.models.hr_decisions import HrDecision
from app.v1.db.models.permissions import Permission
from app.v1.db.models.resumes import Resume
from app.v1.db.models.roles import Role
from app.v1.db.models.user import User
from app.v1.db.models.cross_job_matches import CrossJobMatch


class AdminRepository:
    """
    Repository for admin-level database operations.

    Handles CRUD operations for users, roles, permissions, audit logs,
    and provides analytics and reporting queries for administrative purposes.
    """

    async def get_all_users(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        search: str | None = None,
    ) -> list[User]:
        """
        Retrieve all users with pagination.

        @param db - Database session
        @param skip - Number of records to skip for pagination
        @param limit - Maximum number of records to return
        @returns List of User objects ordered by creation date descending
        """
        stmt = select(User).options(selectinload(User.role))
        if search:
            search_term = f"%{search}%"
            stmt = stmt.join(Role, User.role_id == Role.id).where(
                or_(
                    User.email.ilike(search_term),
                    User.full_name.ilike(search_term),
                    Role.name.ilike(search_term),
                )
            )

        result = await db.execute(stmt.offset(skip).limit(limit).order_by(desc(User.created_at)))
        return list(result.scalars().all())

    async def count_all_users(
        self, db: AsyncSession, search: str | None = None
    ) -> int:
        """Get total number of users."""
        stmt = select(func.count(User.id))
        if search:
            search_term = f"%{search}%"
            stmt = stmt.select_from(User).join(Role, User.role_id == Role.id).where(
                or_(
                    User.email.ilike(search_term),
                    User.full_name.ilike(search_term),
                    Role.name.ilike(search_term),
                )
            )
        return await db.scalar(stmt) or 0

    async def get_user_by_id(self, db: AsyncSession, user_id: uuid.UUID) -> User | None:
        """
        Retrieve a user by their unique identifier.

        @param db - Database session
        @param user_id - Unique identifier of the user
        @returns User object if found, None otherwise
        """
        stmt = select(User).options(selectinload(User.role)).where(User.id == user_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_user_by_email(self, db: AsyncSession, email: str) -> User | None:
        """
        Retrieve a user by their email address.

        @param db - Database session
        @param email - Email address of the user
        @returns User object if found, None otherwise
        """
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def update_user(
        self, db: AsyncSession, user: User, update_data: dict
    ) -> User:
        """
        Update user fields with provided data.

        @param db - Database session
        @param user - User object to update
        @param update_data - Dictionary of fields to update
        @returns Updated user object
        """
        for key, value in update_data.items():
            if value is not None:
                setattr(user, key, value)
        await db.commit()
        await db.refresh(user)
        # Load role to avoid lazy load error during serialization
        await db.execute(
            select(User).options(selectinload(User.role)).where(User.id == user.id)
        )
        return user

    async def delete_user(self, db: AsyncSession, user: User) -> None:
        """
        Delete a user from the database.

        @param db - Database session
        @param user - User object to delete
        """
        await db.delete(user)
        await db.commit()

    async def get_all_roles(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        search: str | None = None,
    ) -> list[Role]:
        """
        Retrieve all roles with pagination and optional search by name.
        """
        stmt = (
            select(Role, func.count(User.id).label("user_count"))
            .outerjoin(User, User.role_id == Role.id)
            .group_by(Role.id)
        )
        if search:
            stmt = stmt.where(Role.name.ilike(f"%{search}%"))

        result = await db.execute(stmt.offset(skip).limit(limit).order_by(Role.id.desc()))
        
        roles = []
        for role, count in result.all():
            role.user_count = count
            roles.append(role)
        return roles

    async def count_all_roles(
        self, db: AsyncSession, search: str | None = None
    ) -> int:
        """Get total number of roles with optional search by name."""
        stmt = select(func.count(Role.id))
        if search:
            stmt = stmt.where(Role.name.ilike(f"%{search}%"))
        return await db.scalar(stmt) or 0

    async def get_role_by_id(self, db: AsyncSession, role_id: uuid.UUID) -> Role | None:
        """
        Retrieve a role by its unique identifier with permissions.

        @param db - Database session
        @param role_id - Unique identifier of the role
        @returns Role object if found, None otherwise
        """
        result = await db.execute(
            select(Role)
            .where(Role.id == role_id)
            .options(selectinload(Role.permissions))
        )
        return result.scalar_one_or_none()

    async def get_role_by_name(self, db: AsyncSession, name: str) -> Role | None:
        """
        Retrieve a role by its name.

        @param db - Database session
        @param name - Name of the role
        @returns Role object if found, None otherwise
        """
        result = await db.execute(select(Role).where(func.lower(Role.name) == func.lower(name)))
        return result.scalar_one_or_none()

    async def create_role(self, db: AsyncSession, role: Role) -> Role:
        """
        Create a new role in the database.

        @param db - Database session
        @param role - Role object to create
        @returns Created role object
        """
        db.add(role)
        await db.commit()
        await db.refresh(role)
        return role

    async def update_role(
        self, db: AsyncSession, role: Role, update_data: dict
    ) -> Role:
        """
        Update role fields with provided data.

        @param db - Database session
        @param role - Role object to update
        @param update_data - Dictionary of fields to update
        @returns Updated role object
        """
        for key, value in update_data.items():
            if value is not None:
                setattr(role, key, value)
        await db.commit()
        await db.refresh(role)
        return role

    async def delete_role(self, db: AsyncSession, role: Role) -> None:
        """
        Delete a role from the database.

        @param db - Database session
        @param role - Role object to delete
        """
        await db.delete(role)
        await db.commit()

    async def get_all_permissions(
        self, db: AsyncSession, skip: int = 0, limit: int = 100
    ) -> list[Permission]:
        """
        Retrieve all permissions with pagination.

        @param db - Database session
        @param skip - Number of records to skip for pagination
        @param limit - Maximum number of records to return
        @returns List of Permission objects ordered by name
        """
        result = await db.execute(
            select(Permission).offset(skip).limit(limit).order_by(Permission.id.desc())
        )
        return list(result.scalars().all())

    async def count_all_permissions(self, db: AsyncSession) -> int:
        """Get total number of permissions."""
        return await db.scalar(select(func.count(Permission.id))) or 0

    async def get_permission_by_id(
        self, db: AsyncSession, permission_id: uuid.UUID
    ) -> Permission | None:
        """
        Retrieve a permission by its unique identifier.

        @param db - Database session
        @param permission_id - Unique identifier of the permission
        @returns Permission object if found, None otherwise
        """
        return await db.get(Permission, permission_id)

    async def get_permission_by_name(
        self, db: AsyncSession, name: str
    ) -> Permission | None:
        """
        Retrieve a permission by its name.

        @param db - Database session
        @param name - Name of the permission
        @returns Permission object if found, None otherwise
        """
        result = await db.execute(select(Permission).where(func.lower(Permission.name) == func.lower(name)))
        return result.scalar_one_or_none()

    async def create_permission(
        self, db: AsyncSession, permission: Permission
    ) -> Permission:
        """
        Create a new permission in the database.

        @param db - Database session
        @param permission - Permission object to create
        @returns Created permission object
        """
        db.add(permission)
        await db.commit()
        await db.refresh(permission)
        return permission

    async def delete_permission(self, db: AsyncSession, permission: Permission) -> None:
        """
        Delete a permission from the database.

        @param db - Database session
        @param permission - Permission object to delete
        """
        await db.delete(permission)
        await db.commit()

    async def assign_permissions_to_role(
        self, db: AsyncSession, role: Role, permission_ids: list[uuid.UUID]
    ) -> Role:
        """
        Assign multiple permissions to a role.

        @param db - Database session
        @param role - Role to assign permissions to
        @param permission_ids - List of permission identifiers to assign
        @returns Updated role with assigned permissions
        """
        role = await self.get_role_by_id(db, role.id)
        permissions = await db.execute(
            select(Permission).where(Permission.id.in_(permission_ids))
        )
        role.permissions = list(permissions.scalars().all())
        await db.commit()
        await db.refresh(role)
        # Re-fetch with selectinload to avoid lazy loading issues in serialize_response
        return await self.get_role_by_id(db, role.id)

    async def get_audit_logs(
        self, db: AsyncSession, skip: int = 0, limit: int = 100, q: str | None = None
    ) -> list[AuditLog]:
        """
        Retrieve all audit logs with pagination and user names.

        @param db - Database session
        @param skip - Number of records to skip for pagination
        @param limit - Maximum number of records to return
        @returns List of AuditLog objects ordered by creation date descending
        """
        stmt = select(AuditLog).options(selectinload(AuditLog.user))
        if q:
            stmt = stmt.where(AuditLog.action.ilike(f"%{q}%"))
        stmt = stmt.offset(skip).limit(limit).order_by(desc(AuditLog.created_at))
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def count_all_audit_logs(self, db: AsyncSession, q: str | None = None) -> int:
        """Get total number of audit logs, optionally filtered by action."""
        stmt = select(func.count(AuditLog.id))
        if q:
            stmt = stmt.where(AuditLog.action.ilike(f"%{q}%"))
        return await db.scalar(stmt) or 0

    async def get_audit_logs_by_user(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> list[AuditLog]:
        """
        Retrieve audit logs for a specific user.

        @param db - Database session
        @param user_id - Unique identifier of the user
        @param skip - Number of records to skip for pagination
        @param limit - Maximum number of records to return
        @returns List of AuditLog objects for the user
        """
        result = await db.execute(
            select(AuditLog)
            .where(AuditLog.user_id == user_id)
            .offset(skip)
            .limit(limit)
            .order_by(desc(AuditLog.created_at))
        )
        return list(result.scalars().all())

    async def create_audit_log(self, db: AsyncSession, audit_log: AuditLog) -> AuditLog:
        """
        Create a new audit log entry.

        @param db - Database session
        @param audit_log - AuditLog object to create
        @returns Created audit log object
        """
        db.add(audit_log)
        await db.commit()
        await db.refresh(audit_log)
        return audit_log

    async def get_recent_uploads(
        self, db: AsyncSession, skip: int = 0, limit: int = 50, q: str | None = None
    ) -> list[File]:
        """
        Retrieve recent file uploads.

        @param db - Database session
        @param skip - Number of records to skip for pagination
        @param limit - Maximum number of records to return
        @returns List of File objects ordered by creation date descending
        """
        stmt = select(File).options(selectinload(File.owner), selectinload(File.candidate))
        if q:
            stmt = stmt.where(File.file_name.ilike(f"%{q}%"))
        stmt = stmt.offset(skip).limit(limit).order_by(desc(File.created_at))
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def count_recent_uploads(self, db: AsyncSession, q: str | None = None) -> int:
        """Get total number of uploaded files, optionally filtered by file name."""
        stmt = select(func.count(File.id))
        if q:
            stmt = stmt.where(File.file_name.ilike(f"%{q}%"))
        return await db.scalar(stmt) or 0

    async def get_analytics_summary(self, db: AsyncSession) -> dict:
        """
        Get summary statistics for analytics.

        @param db - Database session
        @returns Dictionary containing total counts for users, roles, permissions, jobs, candidates, resumes, and active counts
        """
        # Core counts
        total_users = await db.scalar(select(func.count(User.id))) or 0
        total_roles = await db.scalar(select(func.count(Role.id))) or 0
        total_permissions = await db.scalar(select(func.count(Permission.id))) or 0
        total_jobs = await db.scalar(select(func.count(Job.id))) or 0
        active_jobs = await db.scalar(select(func.count(Job.id)).where(Job.is_active)) or 0
        active_users = await db.scalar(select(func.count(User.id)).where(User.is_active)) or 0

        # 1. Total Unique Candidates (Only those with at least one successfully parsed resume)
        total_candidates = await db.scalar(
            select(func.count(func.distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text)))))
            .join(Resume, Resume.candidate_id == Candidate.id)
            .where(Resume.parsed.is_(True))
        ) or 0
        
        # 2. Screening Stats - Strict Deduplication by Unique Individual
        # Pick the 'best' status for each person: Passed (0) > Failed (1) > Pending (2)
        screening_subq = (
            select(
                func.coalesce(Candidate.email, func.cast(Candidate.id, Text)).label("unique_id"),
                Resume.pass_fail,
                Resume.parsed,
                func.row_number()
                .over(
                    partition_by=func.coalesce(Candidate.email, func.cast(Candidate.id, Text)),
                    order_by=(
                        case((Resume.parsed.is_(True), 0), else_=1), # Prefer parsed resumes
                        case((Resume.pass_fail == "passed", 0), (Resume.pass_fail == "failed", 1), else_=2),
                        Resume.uploaded_at.desc()
                    )
                )
                .label("rn"),
            )
            .join(Resume, Resume.candidate_id == Candidate.id)
        ).subquery()

        # Count those with at least one parsed resume
        processed_res = await db.execute(
            select(screening_subq.c.pass_fail, func.count())
            .where(screening_subq.c.rn == 1, screening_subq.c.parsed.is_(True))
            .group_by(screening_subq.c.pass_fail)
        )
        counts = {row[0]: row[1] for row in processed_res.all()}
        
        total_passed = counts.get("passed", 0)
        total_failed = counts.get("failed", 0)
        total_pending = counts.get("pending", 0)
        
        # Count those who ONLY have unprocessed resumes
        total_unprocessed = await db.scalar(
            select(func.count())
            .select_from(screening_subq)
            .where(screening_subq.c.rn == 1, screening_subq.c.parsed.is_(False))
        ) or 0

        total_resumes = total_passed + total_failed + total_pending + total_unprocessed

        # 3. HR Decisions - Strict Deduplication by Unique Individual
        # Prioritize: Approved/Passed (0) > Maybe (1) > Rejected/Failed (2)
        decision_subq = (
            select(
                func.coalesce(Candidate.email, func.cast(Candidate.id, Text)).label("unique_id"),
                func.lower(HrDecision.decision).label("decision"),
                func.row_number()
                .over(
                    partition_by=func.coalesce(Candidate.email, func.cast(Candidate.id, Text)),
                    order_by=(
                        case((func.lower(HrDecision.decision) == "pass", 0), (func.lower(HrDecision.decision) == "may be", 1), else_=2),
                        HrDecision.decided_at.desc()
                    )
                )
                .label("rn"),
            )
            .join(Candidate, HrDecision.candidate_id == Candidate.id)
        ).subquery()

        decision_res = await db.execute(
            select(decision_subq.c.decision, func.count())
            .where(decision_subq.c.rn == 1)
            .group_by(decision_subq.c.decision)
        )
        decision_counts = {row[0]: row[1] for row in decision_res.all()}
        
        passed_count = decision_counts.get("pass", 0)
        maybe_count = decision_counts.get("may be", 0)
        failed_count = decision_counts.get("fail", 0)
        
        hr_decision_count = passed_count + maybe_count + failed_count
        pending_decision_count = max(0, total_candidates - hr_decision_count)

        return {
            "total_users": total_users,
            "total_roles": total_roles,
            "total_permissions": total_permissions,
            "total_jobs": total_jobs,
            "total_candidates": total_candidates,
            "total_resumes": total_resumes,
            "total_passed": total_passed,
            "total_failed": total_failed,
            "total_pending": total_pending,
            "total_unprocessed": total_unprocessed,
            "active_jobs": active_jobs,
            "active_users": active_users,
            "passed_count": passed_count,
            "maybe_count": maybe_count,
            "failed_count": failed_count,
            "hr_decision_count": hr_decision_count,
            "pending_decision_count": pending_decision_count,
        }

    async def get_hiring_report(
        self,
        db: AsyncSession,
        job_id: uuid.UUID | None = None,
        stage_name: str | None = None,
    ) -> dict:
        """
        Get detailed hiring analytics report.

        @param job_id: optional — filter pipeline_stats to a single job.
        @param stage_name: optional — filter pipeline_stats to a specific stage name.
        """
        total_jobs = await db.scalar(select(func.count(Job.id))) or 0
        active_jobs = (await db.scalar(select(func.count(Job.id)).where(Job.is_active)) or 0)
        
        # Use robust unique candidate count (Deduplicated by email)
        total_candidates = await db.scalar(
            select(func.count(func.distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text)))))
        ) or 0

        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        resumes_last_30_days = (
            await db.scalar(
                select(func.count(func.distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text)))))
                .join(Resume, Resume.candidate_id == Candidate.id)
                .where(Resume.uploaded_at >= thirty_days_ago)
            )
            or 0
        )

        avg_score = await db.scalar(
            select(func.avg(Resume.resume_score)).where(Resume.resume_score.isnot(None))
        )

        # Reuse deduplicated screening stats logic
        analytics = await self.get_analytics_summary(db)
        
        hr_decided_count = analytics["hr_decision_count"]
        pending_count = analytics["pending_decision_count"]

        jobs_stmt = select(Job).order_by(Job.created_at.desc()).limit(20)
        if job_id:
            jobs_stmt = jobs_stmt.where(Job.id == job_id)
        jobs_result = await db.execute(jobs_stmt)
        jobs = list(jobs_result.scalars().all())

        from app.v1.db.models.resume_version_results import ResumeVersionResult

        candidates_by_job = []
        for job in jobs:
            job_unique_stmt = select(
                func.count(func.distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text))))
            ).join(Resume, Resume.candidate_id == Candidate.id).where(
                and_(
                    Resume.parsed.is_(True),
                    or_(
                        Candidate.applied_job_id == job.id,
                        Candidate.id.in_(
                            select(CrossJobMatch.candidate_id).where(CrossJobMatch.matched_job_id == job.id)
                        ),
                        Candidate.id.in_(
                            select(HrDecision.candidate_id).where(HrDecision.job_id == job.id)
                        )
                    )
                )
            )
            job_candidate_count = await db.scalar(job_unique_stmt) or 0
            
            # Count passed/failed screening results for this job
            job_passed_stmt = select(func.count(func.distinct(ResumeVersionResult.resume_id))).where(
                ResumeVersionResult.job_id == job.id,
                ResumeVersionResult.pass_fail == "passed"
            )
            job_failed_stmt = select(func.count(func.distinct(ResumeVersionResult.resume_id))).where(
                ResumeVersionResult.job_id == job.id,
                ResumeVersionResult.pass_fail == "failed"
            )
            
            job_passed_count = await db.scalar(job_passed_stmt) or 0
            job_failed_count = await db.scalar(job_failed_stmt) or 0
            
            candidates_by_job.append(
                {
                    "job_id": str(job.id),
                    "job_title": job.title,
                    "department": job.department.name if job.department else None,
                    "candidate_count": job_candidate_count,
                    "passed_count": job_passed_count,
                    "failed_count": job_failed_count,
                }
            )

        # 4. Optimized Pipeline Stats for Stacked Bar Chart
        from app.v1.db.models.candidate_stages import CandidateStage
        from app.v1.db.models.job_stage_configs import JobStageConfig
        from app.v1.db.models.stage_templates import StageTemplate

        job_ids = [job.id for job in jobs]
        job_names = [job.title for job in jobs]

        # A. Count Resume Screening (Stage 0) completions in bulk
        screening_stmt = (
            select(JobStageConfig.job_id, func.count(func.distinct(CandidateStage.candidate_id)))
            .join(CandidateStage, JobStageConfig.id == CandidateStage.job_stage_id)
            .where(JobStageConfig.job_id.in_(job_ids), JobStageConfig.stage_order == 1)
            .group_by(JobStageConfig.job_id)
        )
        screening_res = await db.execute(screening_stmt)
        screening_counts = {row[0]: row[1] for row in screening_res.all()}

        # B. Count Interview Stage completions in bulk
        stage_stmt = (
            select(JobStageConfig.job_id, StageTemplate.name, JobStageConfig.stage_order, func.count(CandidateStage.id))
            .join(JobStageConfig, JobStageConfig.template_id == StageTemplate.id)
            .join(CandidateStage, CandidateStage.job_stage_id == JobStageConfig.id)
            .where(JobStageConfig.job_id.in_(job_ids), CandidateStage.status == "completed")
            .group_by(JobStageConfig.job_id, StageTemplate.name, JobStageConfig.stage_order)
        )
        stage_res = await db.execute(stage_stmt)
        
        # nested map: job_id -> stage_name -> count
        stage_data_map = {}
        for jid, s_name, s_order, count in stage_res.all():
            if jid not in stage_data_map:
                stage_data_map[jid] = {}
            stage_data_map[jid][s_name] = count

        all_stages_stmt = (
            select(StageTemplate.name)
            .join(JobStageConfig, JobStageConfig.template_id == StageTemplate.id)
            .where(JobStageConfig.job_id.in_(job_ids))
            .group_by(StageTemplate.name)
            .order_by(func.min(JobStageConfig.stage_order).asc(), StageTemplate.name.asc())
        )
        unique_stages_res = await db.execute(all_stages_stmt)
        unique_stages = [row[0] for row in unique_stages_res.all()]
        
        # Ensure 'Resume Screening' is always the first stage in the funnel
        if "Resume Screening" not in unique_stages:
            unique_stages.insert(0, "Resume Screening")
        elif unique_stages[0] != "Resume Screening":
            unique_stages.remove("Resume Screening")
            unique_stages.insert(0, "Resume Screening")

        # D. Transform to requested format: [{stage: "N", Job1: C1, Job2: C2}, ..., {job_names: [...]}]
        # Map job titles to their total candidate counts for Resume Screening (Top of Funnel)
        job_title_to_total = {c["job_title"]: c["candidate_count"] for c in candidates_by_job}
        
        final_pipeline_stats = []
        for s_name in unique_stages:
            if stage_name and stage_name.lower() != s_name.lower():
                continue
                
            entry = {"stage": s_name}
            for job in jobs:
                if s_name == "Resume Screening":
                    # Use total candidates for the job as the top-of-funnel count
                    entry[job.title] = job_title_to_total.get(job.title, 0)
                else:
                    entry[job.title] = stage_data_map.get(job.id, {}).get(s_name, 0)
            final_pipeline_stats.append(entry)

        # Add job_names metadata at the end as requested
        final_pipeline_stats.append({"job_names": job_names})

        return {
            "total_jobs": total_jobs,
            "active_jobs": active_jobs,
            "total_candidates": total_candidates,
            "total_passed": analytics["total_passed"],
            "total_failed": analytics["total_failed"],
            "total_pending": analytics["total_pending"],
            "total_unprocessed": analytics["total_unprocessed"],
            "candidates_by_job": candidates_by_job,
            "job_pipeline_stats": final_pipeline_stats,
            "resumes_uploaded_last_30_days": resumes_last_30_days,
            "average_resume_score": float(avg_score) if avg_score else None,
            "hr_decided_count": hr_decided_count,
            "pending_count": pending_count,
        }


    async def get_pipeline_stats(
        self,
        db: AsyncSession,
        job_id: uuid.UUID | None = None,
        stage_name: str | None = None,
    ) -> list[dict]:
        """
        Return pipeline stats filtered by job and/or stage.
        Uses optimized bulk queries and stage-oriented format.
        """
        from app.v1.db.models.candidate_stages import CandidateStage
        from app.v1.db.models.job_stage_configs import JobStageConfig
        from app.v1.db.models.stage_templates import StageTemplate

        # 1. Load jobs
        job_stmt = select(Job).where(Job.is_active == True).order_by(Job.created_at.desc()).limit(20)
        if job_id:
            job_stmt = job_stmt.where(Job.id == job_id)
        jobs = (await db.execute(job_stmt)).scalars().all()
        
        if not jobs:
            return []

        job_ids = [job.id for job in jobs]
        job_names = [job.title for job in jobs]

        # 2. Bulk screening counts
        screening_stmt = (
            select(JobStageConfig.job_id, func.count(func.distinct(CandidateStage.candidate_id)))
            .join(CandidateStage, JobStageConfig.id == CandidateStage.job_stage_id)
            .where(JobStageConfig.job_id.in_(job_ids), JobStageConfig.stage_order == 1)
            .group_by(JobStageConfig.job_id)
        )
        screening_counts = {row[0]: row[1] for row in (await db.execute(screening_stmt)).all()}

        # 3. Bulk stage counts
        stage_stmt = (
            select(JobStageConfig.job_id, StageTemplate.name, func.count(CandidateStage.id))
            .join(JobStageConfig, JobStageConfig.template_id == StageTemplate.id)
            .join(CandidateStage, CandidateStage.job_stage_id == JobStageConfig.id)
            .where(JobStageConfig.job_id.in_(job_ids), CandidateStage.status == "completed")
            .group_by(JobStageConfig.job_id, StageTemplate.name)
        )
        stage_data_map = {}
        for jid, s_name, count in (await db.execute(stage_stmt)).all():
            if jid not in stage_data_map: stage_data_map[jid] = {}
            stage_data_map[jid][s_name] = count

        # 4. Get unique stages ordered by their minimum occurrence in any job pipeline
        unique_stages_stmt = (
            select(StageTemplate.name)
            .join(JobStageConfig, JobStageConfig.template_id == StageTemplate.id)
            .where(JobStageConfig.job_id.in_(job_ids))
            .group_by(StageTemplate.name)
            .order_by(func.min(JobStageConfig.stage_order).asc(), StageTemplate.name.asc())
        )
        unique_stages_res = await db.execute(unique_stages_stmt)
        unique_stages = [row[0] for row in unique_stages_res.all()]
        
        # Ensure 'Resume Screening' is always included as the starting funnel point
        if "Resume Screening" not in unique_stages:
            unique_stages.insert(0, "Resume Screening")
        elif unique_stages[0] != "Resume Screening":
            unique_stages.remove("Resume Screening")
            unique_stages.insert(0, "Resume Screening")

        # 5. Transform
        result = []
        for s_name in unique_stages:
            if stage_name and stage_name.lower() != s_name.lower():
                continue
            entry = {"stage": s_name}
            for job in jobs:
                if s_name == "Resume Screening":
                    entry[job.title] = screening_counts.get(job.id, 0)
                else:
                    entry[job.title] = stage_data_map.get(job.id, {}).get(s_name, 0)
            result.append(entry)
        
        result.append({"job_names": job_names})
        return result


admin_repository = AdminRepository()
