"""
HR Decision Service - Aggregator delegation wrapper.
"""

import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.schemas.hr_decision import (
    HRDecisionCreate,
    HRDecisionResponse,
    HRDecisionHistoryResponse,
    HRDecisionUpdate,
    HRDecisionSummary,
    HRJobDecisionSummary,
)
from app.v1.services.hr_decision_crud import (
    create_decision_impl,
    update_decision_impl,
    get_decision_history_impl,
)
from app.v1.services.hr_decision_metrics import (
    get_decision_summary_impl,
    get_job_decision_summary_impl,
    get_job_screening_summary_impl,
    get_global_screening_summary_impl,
    get_global_decision_summary_impl,
)


class HRDecisionService:
    """Service for managing HR decisions, delegating core logic to sub-modules."""

    async def create_decision(
        self,
        db: AsyncSession,
        candidate_id: uuid.UUID,
        decision_data: HRDecisionCreate,
        user_id: uuid.UUID,
        stage_config_id: uuid.UUID | None = None,
    ) -> HRDecisionResponse:
        """Create a new HR decision with validation."""
        return await create_decision_impl(
            db=db,
            candidate_id=candidate_id,
            decision_data=decision_data,
            user_id=user_id,
            stage_config_id=stage_config_id,
        )

    async def get_decision_history(
        self,
        db: AsyncSession,
        candidate_id: uuid.UUID,
        job_id: uuid.UUID | None = None,
        stage_config_id: uuid.UUID | None = None,
    ) -> HRDecisionHistoryResponse:
        """Get complete decision history for a candidate."""
        return await get_decision_history_impl(
            db=db,
            candidate_id=candidate_id,
            job_id=job_id,
            stage_config_id=stage_config_id,
        )

    async def update_decision(
        self,
        db: AsyncSession,
        decision_id: uuid.UUID,
        decision_data: HRDecisionUpdate,
        user_id: uuid.UUID,
    ) -> HRDecisionResponse:
        """Update an existing HR decision."""
        return await update_decision_impl(
            db=db,
            decision_id=decision_id,
            decision_data=decision_data,
            user_id=user_id,
        )

    async def get_decision_summary(
        self,
        db: AsyncSession,
    ) -> HRDecisionSummary:
        """Get global summary: how many candidates are in each decision bucket."""
        return await get_decision_summary_impl(db=db)

    async def get_job_decision_summary(
        self,
        db: AsyncSession,
        job_id: uuid.UUID,
    ) -> HRJobDecisionSummary:
        """Get decision summary scoped to candidates of a specific job (including cross-matches)."""
        return await get_job_decision_summary_impl(db=db, job_id=job_id)

    async def get_job_screening_summary(
        self,
        db: AsyncSession,
        job_id: uuid.UUID,
    ) -> dict[str, int]:
        """Count resumes for a job grouped by pass_fail status, including dynamic cross-matches."""
        return await get_job_screening_summary_impl(db=db, job_id=job_id)

    async def get_global_screening_summary(
        self,
        db: AsyncSession,
    ) -> dict[str, int]:
        """Global unique candidate screening status summary."""
        return await get_global_screening_summary_impl(db=db)

    async def get_global_decision_summary(self, db: AsyncSession) -> dict[str, int]:
        """Global count of latest decisions for all candidates."""
        return await get_global_decision_summary_impl(db=db)


# Create service instance
hr_decision_service = HRDecisionService()
