"""
Data access layer for interview operations.
Follows the same pattern as ResumeUploadRepository.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.v1.db.models.candidates import Candidate
from app.v1.db.models.interviews import Interview
from app.v1.db.models.jobs import Job


class InterviewRepository:
    """Repository for interview database operations."""

    async def get_candidate(
        self, db: AsyncSession, candidate_id: uuid.UUID
    ) -> Candidate | None:
        return await db.get(Candidate, candidate_id)

    async def get_job(
        self, db: AsyncSession, job_id: uuid.UUID
    ) -> Job | None:
        return await db.get(Job, job_id)

    async def create_interview(
        self,
        db: AsyncSession,
        *,
        candidate_id: uuid.UUID,
        job_id: uuid.UUID,
        interviewer_id: uuid.UUID,
        stage: int = 1,
        status: str = "pending",
    ) -> Interview:
        """Create a new interview record."""
        interview = Interview(
            candidate_id=candidate_id,
            job_id=job_id,
            interviewer_id=interviewer_id,
            stage=stage,
            status=status,
        )
        db.add(interview)
        await db.flush()
        return interview

    async def get_interview(
        self,
        db: AsyncSession,
        interview_id: uuid.UUID,
    ) -> Interview | None:
        """Get a single interview by ID with relationships loaded."""
        return await db.scalar(
            select(Interview)
            .options(
                selectinload(Interview.candidate),
                selectinload(Interview.job),
                selectinload(Interview.interviewer),
            )
            .where(Interview.id == interview_id)
        )

    async def get_interviews_for_candidate(
        self,
        db: AsyncSession,
        *,
        candidate_id: uuid.UUID,
    ) -> list[Interview]:
        """Get all interviews for a specific candidate."""
        return list(
            (
                await db.scalars(
                    select(Interview)
                    .where(Interview.candidate_id == candidate_id)
                    .order_by(Interview.created_at.desc())
                )
            ).all()
        )

    async def get_interviews_for_job(
        self,
        db: AsyncSession,
        *,
        job_id: uuid.UUID,
    ) -> list[Interview]:
        """Get all interviews for a specific job."""
        return list(
            (
                await db.scalars(
                    select(Interview)
                    .options(selectinload(Interview.candidate))
                    .where(Interview.job_id == job_id)
                    .order_by(Interview.created_at.desc())
                )
            ).all()
        )

    async def update_interview_status(
        self,
        db: AsyncSession,
        *,
        interview_id: uuid.UUID,
        status: str,
    ) -> None:
        """Update the status of an interview."""
        await db.execute(
            update(Interview)
            .where(Interview.id == interview_id)
            .values(status=status)
        )

    async def update_candidate_status(
        self,
        db: AsyncSession,
        *,
        candidate_id: uuid.UUID,
        status: str,
    ) -> None:
        """Update the candidate's current_status in the hiring pipeline."""
        await db.execute(
            update(Candidate)
            .where(Candidate.id == candidate_id)
            .values(current_status=status)
        )

    async def commit(self, db: AsyncSession) -> None:
        await db.commit()

    async def rollback(self, db: AsyncSession) -> None:
        await db.rollback()


interview_repository = InterviewRepository()
