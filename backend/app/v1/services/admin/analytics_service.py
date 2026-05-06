import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.repository.admin_repository import admin_repository
from app.v1.schemas.admin import AnalyticsSummary, HiringReport, RecentUploadRead, JobPipelineStats
from app.v1.schemas.response import PaginatedData
from app.v1.core.cache import cache


class AnalyticsService:
    """
    Service for admin-level analytics and reporting.
    """

    async def get_recent_uploads(
        self, db: AsyncSession, skip: int = 0, limit: int = 50, q: str | None = None
    ) -> PaginatedData[RecentUploadRead]:
        """
        Retrieve recent file uploads.

        @param db - Database session
        @param skip - Number of records to skip for pagination
        @param limit - Maximum number of records to return
        @returns List of File objects
        """
        uploads = await admin_repository.get_recent_uploads(
            db=db, skip=skip, limit=limit, q=q
        )
        total = await admin_repository.count_recent_uploads(db=db, q=q)
        return PaginatedData[RecentUploadRead](
            data=[RecentUploadRead.model_validate(upload) for upload in uploads],
            total=total,
        )

    async def get_analytics_summary(self, db: AsyncSession) -> AnalyticsSummary:
        """
        Get analytics summary with system statistics.

        @param db - Database session
        @returns AnalyticsSummary with counts for users, roles, permissions, jobs, candidates, and resumes
        """
        cache_key = "analytics:summary"
        cached = await cache.get(cache_key)
        if cached:
            return AnalyticsSummary(**cached)

        data = await admin_repository.get_analytics_summary(db=db)
        summary = AnalyticsSummary(**data)
        await cache.set(cache_key, summary.model_dump(), ttl=600)  # 10 min
        return summary

    async def get_hiring_report(
        self,
        db: AsyncSession,
        job_id: uuid.UUID | None = None,
        stage_name: str | None = None,
    ) -> HiringReport:
        """
        Get detailed hiring analytics report.

        @param db - Database session
        @param job_id - Optional job UUID to filter pipeline stats to a single job
        @param stage_name - Optional stage name to filter pipeline stats (case-insensitive)
        @returns HiringReport with job statistics, candidate metrics, and resume performance data
        """
        cache_key = f"analytics:hiring_report:{job_id or 'all'}:{stage_name or 'all'}"
        cached = await cache.get(cache_key)
        if cached:
            return HiringReport(**cached)

        data = await admin_repository.get_hiring_report(
            db=db, job_id=job_id, stage_name=stage_name
        )
        report = HiringReport(**data)
        await cache.set(cache_key, report.model_dump(), ttl=300)  # 5 min
        return report

    async def get_pipeline_stats(
        self,
        db: AsyncSession,
        job_id: uuid.UUID | None = None,
        stage_name: str | None = None,
    ) -> list[dict]:
        """
        Get pipeline stats filtered by job and/or stage.

        @param db - Database session
        @param job_id - Optional job UUID to filter to a single job
        @param stage_name - Optional stage name to filter results (case-insensitive)
        @returns List of stage-based statistics with job names as keys
        """
        cache_key = f"analytics:pipeline_stats:{job_id or 'all'}:{stage_name or 'all'}"
        cached = await cache.get(cache_key)
        if cached:
            return cached

        data = await admin_repository.get_pipeline_stats(
            db=db, job_id=job_id, stage_name=stage_name
        )
        await cache.set(cache_key, data, ttl=300)  # 5 min
        return data


analytics_service = AnalyticsService()
