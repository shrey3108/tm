import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.job_stage_configs import JobStageConfig
from app.v1.services.admin.system_service import system_service


class CandidateStageService:
    """
    Service for managing candidate progress through hiring stages.
    """

    async def initiate_candidate_pipeline(
        self, db: AsyncSession, candidate_id: uuid.UUID, job_id: uuid.UUID
    ) -> list[CandidateStage]:
        """
        Initialize the entire pipeline for a candidate based on the job's stage configuration.
        The first stage will be set to 'active', all others to 'pending'.
        """
        # 1. Fetch job stages ordered by stage_order
        stmt = (
            select(JobStageConfig)
            .where(JobStageConfig.job_id == job_id)
            .options(selectinload(JobStageConfig.template))
            .order_by(JobStageConfig.stage_order.asc())
        )
        result = await db.execute(stmt)
        job_stages = result.scalars().all()

        if not job_stages:
            return []

        # 2. Check if stages already exist for this candidate and job
        existing_stmt = select(CandidateStage).where(
            CandidateStage.candidate_id == candidate_id,
            CandidateStage.job_stage_id.in_([js.id for js in job_stages])
        )
        existing_res = await db.execute(existing_stmt)
        if existing_res.scalars().first():
            # Already initiated
            return (await db.execute(
                select(CandidateStage)
                .where(CandidateStage.candidate_id == candidate_id)
                .join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
                .where(JobStageConfig.job_id == job_id)
                .order_by(JobStageConfig.stage_order.asc())
            )).scalars().all()

        # 3. Create CandidateStage entries
        new_stages = []
        default_stage_idx = 0
        for i, js in enumerate(job_stages):
            if js.is_default:
                default_stage_idx = i
            
            cs = CandidateStage(
                candidate_id=candidate_id,
                job_stage_id=js.id,
                status="pending",
                started_at=None,
            )
            db.add(cs)
            new_stages.append(cs)

        # 4. Activate the default stage (or first stage if none marked)
        new_stages[default_stage_idx].status = "active"
        new_stages[default_stage_idx].started_at = datetime.utcnow()

        # 5. Update candidate's current_status to the active stage template name
        await db.execute(
            update(Candidate)
            .where(Candidate.id == candidate_id)
            .values(current_status=job_stages[default_stage_idx].template.name if job_stages[default_stage_idx].template else "Initial Screening")
        )

        await db.flush()
        # Invalidate cache for the job
        await system_service.invalidate_job_cache(job_id)
        return new_stages

    async def advance_candidate(
        self, db: AsyncSession, candidate_id: uuid.UUID, current_stage_id: uuid.UUID, success: bool = True
    ) -> Optional[CandidateStage]:
        """
        Mark current stage as completed/failed and activate the next stage if successful.
        """
        # 1. Fetch current candidate stage with its config and template
        stmt = (
            select(CandidateStage)
            .where(CandidateStage.id == current_stage_id)
            .options(selectinload(CandidateStage.job_stage).selectinload(JobStageConfig.template))
        )
        res = await db.execute(stmt)
        current_cs = res.scalar_one_or_none()

        if not current_cs:
            return None

        # 2. Mark current stage as done
        current_cs.status = "completed" if success else "failed"
        current_cs.completed_at = datetime.utcnow()
        job_id = current_cs.job_stage.job_id

        if not success:
            # Check if candidate is active in ANY other job before marking as globally "Rejected"
            # However, for now, we'll just mark as "Rejected (Job Specific)" if possible, 
            # but since current_status is just a string, we'll check if this is their primary application.
            candidate = await db.get(Candidate, candidate_id)
            if candidate and candidate.applied_job_id == job_id:
                candidate.current_status = "Failed"
            
            await db.flush()
            return current_cs

        # 3. Find the next stage in the job pipeline
        next_order = current_cs.job_stage.stage_order + 1

        next_stage_stmt = (
            select(JobStageConfig)
            .where(JobStageConfig.job_id == job_id, JobStageConfig.stage_order == next_order)
            .options(selectinload(JobStageConfig.template))
        )
        next_js_res = await db.execute(next_stage_stmt)
        next_js = next_js_res.scalar_one_or_none()

        if next_js:
            # Activate the pre-created pending stage or create it if missing
            cs_stmt = (
                select(CandidateStage)
                .where(CandidateStage.candidate_id == candidate_id, CandidateStage.job_stage_id == next_js.id)
            )
            cs_res = await db.execute(cs_stmt)
            next_cs = cs_res.scalars().first()

            if next_cs:
                next_cs.status = "active"
                next_cs.started_at = datetime.utcnow()
            else:
                next_cs = CandidateStage(
                    candidate_id=candidate_id,
                    job_stage_id=next_js.id,
                    status="pending",
                    started_at=datetime.utcnow()
                )
                db.add(next_cs)

            # Update candidate status only if it's their primary job or they have no status
            candidate = await db.get(Candidate, candidate_id)
            if candidate and (candidate.applied_job_id == job_id or not candidate.current_status):
                current_stage_name = current_cs.job_stage.template.name if (current_cs.job_stage and current_cs.job_stage.template) else "Stage"
                candidate.current_status = f"{current_stage_name} (Completed)"
            
            await db.flush()
            # Invalidate cache for the job
            await system_service.invalidate_job_cache(job_id)
            return next_cs
        else:
            # End of pipeline
            candidate = await db.get(Candidate, candidate_id)
            if candidate and candidate.applied_job_id == job_id:
                candidate.current_status = "Hiring Process Completed"
            
            await db.flush()
            return None

    async def update_stage_result(
        self, 
        db: AsyncSession, 
        candidate_stage_id: uuid.UUID, 
        evaluation_data: dict, 
        status: Optional[str] = None
    ) -> CandidateStage:
        """
        Record evaluation results for a stage.
        """
        cs = await db.get(CandidateStage, candidate_stage_id)
        if not cs:
            raise ValueError("CandidateStage not found")

        cs.evaluation_data = evaluation_data
        if status:
            cs.status = status
            if status in ["completed", "failed", "skipped"]:
                cs.completed_at = datetime.utcnow()

        await db.flush()
        return cs


candidate_stage_service = CandidateStageService()
