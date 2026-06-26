from datetime import datetime
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.schemas.upload import CandidateResponse
from app.v1.schemas.response import PaginatedData
from app.v1.services.admin.candidate_query_service import candidate_query_service
from app.v1.services.admin.candidate_delete_service import candidate_delete_service
from app.v1.services.admin.candidate_timeline_service import candidate_timeline_service


class CandidateAdminService:
    """
    Backward-compatible facade that delegates to the focused sub-services.

    Existing callers use ``candidate_admin_service.<method>(...)`` which now
    forwards to the appropriate extracted service implementation.
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
        return await candidate_query_service.get_candidates_for_job(
            db=db,
            job_id=job_id,
            skip=skip,
            limit=limit,
            query=query,
            hr_decision=hr_decision,
            hr_score=hr_score,
            jd_version=jd_version,
            start_date=start_date,
            end_date=end_date,
            candidate_id=candidate_id,
            stage_id=stage_id,
            city=city,
            result=result,
            test_email_sent=test_email_sent,
        )

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
        return await candidate_query_service.search_candidates(
            db=db,
            query=query,
            job=job,
            hr_decision=hr_decision,
            hr_score=hr_score,
            city=city,
            result=result,
            stage_id=stage_id,
            start_date=start_date,
            end_date=end_date,
            skip=skip,
            limit=limit,
            test_email_sent=test_email_sent,
        )

    async def delete_candidate_by_identifier(
        self,
        db: AsyncSession,
        admin_user_id: uuid.UUID,
        identifier: str,
    ) -> bool:
        return await candidate_delete_service.delete_candidate_by_identifier(
            db=db,
            admin_user_id=admin_user_id,
            identifier=identifier,
        )

    async def get_candidate_timeline(
        self,
        db: AsyncSession,
        candidate_id: uuid.UUID,
        job_id: uuid.UUID | None = None,
        query: str | None = None,
    ) -> dict[str, Any]:
        return await candidate_timeline_service.get_candidate_timeline(
            db=db,
            candidate_id=candidate_id,
            job_id=job_id,
            query=query,
        )


# Backward-compatible singleton export.
# All existing imports of `candidate_admin_service` continue to work.
candidate_admin_service = CandidateAdminService()
