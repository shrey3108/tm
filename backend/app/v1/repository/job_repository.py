"""
Repository for job-related database operations.
"""

import uuid
import logging
from typing import Any

from sqlalchemy import and_, delete, func, insert, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.v1.db.models.candidates import Candidate
from app.v1.db.models.candidate_skills import candidate_skills
from app.v1.db.models.cover_letters import CoverLetter
from app.v1.db.models.cross_job_matches import CrossJobMatch
from app.v1.db.models.files import File as FileRecord
from app.v1.db.models.hr_decisions import HrDecision
from app.v1.db.models.interviews import Interview
from app.v1.db.models.job_chunks import JobChunk
from app.v1.db.models.job_skills import job_skills
from app.v1.db.models.job_stage_configs import JobStageConfig
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.jobs import Job
from app.v1.db.models.recordings import Recording
from app.v1.db.models.resume_chunks import ResumeChunk
from app.v1.db.models.resume_version_results import ResumeVersionResult
from app.v1.db.models.resumes import Resume
from app.v1.db.models.transcripts import Transcript
from app.v1.schemas.job import JobCreate, JobUpdate
from app.v1.db.models.job_versions import JobVersion

logger = logging.getLogger(__name__)


class JobRepository:
    """
    Repository class for handling Job database operations.
    """

    async def get_multi(
        self, 
        db: AsyncSession, 
        skip: int = 0, 
        limit: int = 100, 
        query: str | None = None,
        status: list[bool] | None = None,
        department_ids: list[uuid.UUID] | None = None,
        priority_ids: list[uuid.UUID] | None = None,
        position_ids: list[uuid.UUID] | None = None,
    ):
        """
        Retrieve multiple job records with pagination and filters.

        Args:
            db (AsyncSession): Database session.
            skip (int): Number of records to skip.
            limit (int): Maximum number of records to return.
            query (str | None): Optional search query for job title.
            status (list[bool] | None): Filter by is_active status(es).
            department_ids (list[UUID] | None): Filter by department(s).
            priority_ids (list[UUID] | None): Filter by priority(s).
            position_ids (list[UUID] | None): Filter by position(s).

        Returns:
            dict[str, object]: A dictionary containing the jobs and total count.
        """
        filters = []
        if query:
            filters.append(Job.title.ilike(f"%{query}%"))
        if status:
            filters.append(Job.is_active.in_(status))
        if department_ids:
            filters.append(Job.department_id.in_(department_ids))
        if priority_ids:
            filters.append(Job.priority_id.in_(priority_ids))
        if position_ids:
            filters.append(Job.position_id.in_(position_ids))

        # 1. Total Count Query
        total_stmt = select(func.count()).select_from(Job)
        if filters:
            total_stmt = total_stmt.where(and_(*filters))
        total = await db.scalar(total_stmt)

        # 2. Data Query
        stmt = (
            select(Job)
            .options(
                selectinload(Job.skills),
                selectinload(Job.stages).selectinload(JobStageConfig.template),
                selectinload(Job.department),
                selectinload(Job.versions),
                selectinload(Job.associates),
            )
        )
        if filters:
            stmt = stmt.where(and_(*filters))
            
        stmt = stmt.order_by(Job.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(stmt)
        
        return {
            "data": list(result.scalars().unique().all()),
            "total": total or 0,
        }

    async def get(self, db: AsyncSession, id: uuid.UUID) -> Job | None:
        """Retrieve a single job with its related skills and stages."""
        stmt = (
            select(Job)
            .options(
                selectinload(Job.skills),
                selectinload(Job.stages).selectinload(JobStageConfig.template),
                selectinload(Job.department),
                selectinload(Job.versions),
                selectinload(Job.associates),
            )
            .where(Job.id == id)
        )
        result = await db.execute(stmt)
        return result.scalars().unique().first()

    async def create(
        self, db: AsyncSession, object: JobCreate, created_by: uuid.UUID
    ) -> Job:
        """Create a job and persist its skill associations."""
        payload = object.model_dump()
        skill_ids = payload.pop("skill_ids", [])
        associate_ids = payload.pop("associate_ids", [])
        payload.pop("stages", None)  # handled separately in job_service, not an ORM field
        payload.pop("skill_weightages", None)  # handled separately in job_service, not an ORM field

        job = Job(**payload, created_by=created_by)

        # Ensure fresh embeddings apply immediately
        from app.v1.core.embeddings import embedding_service
        from app.v1.utils.text import build_job_text

        job.jd_embedding = embedding_service.encode_jd(build_job_text(job))

        db.add(job)
        await db.flush()

        await self._sync_job_chunks(db=db, job=job)

        await self._sync_skills(db=db, job_id=job.id, skill_ids=skill_ids)
        await self._sync_associates(db=db, job_id=job.id, associate_ids=associate_ids)

        from app.v1.db.models.job_versions import JobVersion

        job_version = JobVersion(
            job_id=job.id,
            version_number=1,
            title=job.title,
            vacancy=job.vacancy,
            jd_text=job.jd_text,
            jd_json=job.jd_json,
            jd_embedding=job.jd_embedding,
            custom_extraction_fields=job.custom_extraction_fields,
            passing_threshold=job.passing_threshold,
        )
        db.add(job_version)

        await db.commit()

        created_job = await self.get(db=db, id=job.id)
        if created_job is None:
            raise ValueError("Failed to load created job.")
        return created_job

    async def update(self, db: AsyncSession, id: uuid.UUID, object: JobUpdate) -> Job:
        """Update a job and optionally replace its skill associations."""
        job = await self.get(db=db, id=id)
        if job is None:
            raise ValueError("Job not found.")

        payload = object.model_dump(exclude_unset=True)
        skill_ids = payload.pop("skill_ids", None)
        associate_ids = payload.pop("associate_ids", None)
        payload.pop("stages", None)  # handled separately in job_service, not an ORM field
        payload.pop("skill_weightages", None)  # handled separately in job_service, not an ORM field

        # Remove status from payload to prevent version creation on status changes
        status_change = payload.pop("status", None)

        # Detect actual changes to version-worthy fields
        core_fields = ["title", "department_id", "jd_text", "jd_json", "passing_threshold"]
        core_fields_changed = any(
            k in payload and payload[k] != getattr(job, k)
            for k in core_fields
        )

        extraction_fields_changed = (
            "custom_extraction_fields" in payload 
            and payload["custom_extraction_fields"] != job.custom_extraction_fields
        )

        skills_changed = False
        if skill_ids is not None:
            current_skill_ids = {s.id for s in job.skills}
            new_skill_ids = set(skill_ids)
            if current_skill_ids != new_skill_ids:
                skills_changed = True

        version_worthy_change = (
            core_fields_changed
            or extraction_fields_changed
            or skills_changed
        )

        for key, value in payload.items():
            setattr(job, key, value)

        # Explicitly ensure vacancy is set correctly if provided in payload
        # This acts as a guardrail against any hidden logic that might be shifting the value
        if "vacancy" in payload:
            logger.info(f"Enforcing vacancy update for job {id}: {payload['vacancy']} (original input: {object.vacancy})")
            job.vacancy = payload["vacancy"]

        # Handle status change separately (without triggering version)
        if status_change is not None:
            job.status = status_change

        if core_fields_changed:
            from app.v1.core.embeddings import embedding_service
            from app.v1.utils.text import build_job_text

            job.jd_embedding = embedding_service.encode_jd(build_job_text(job))
            await self._sync_job_chunks(db=db, job=job)

        if skill_ids is not None:
            await self._sync_skills(db=db, job_id=id, skill_ids=skill_ids)

        if associate_ids is not None:
            await self._sync_associates(db=db, job_id=id, associate_ids=associate_ids)

        if version_worthy_change:
            # Increment version to record an update
            job.version = (job.version or 1) + 1

            from app.v1.db.models.job_versions import JobVersion

            job_version = JobVersion(
                job_id=job.id,
                version_number=job.version,
                title=job.title,
                vacancy=job.vacancy,
                jd_text=job.jd_text,
                jd_json=job.jd_json,
                jd_embedding=job.jd_embedding,
                custom_extraction_fields=job.custom_extraction_fields,
                passing_threshold=job.passing_threshold,
            )
            db.add(job_version)

        await db.commit()

        updated_job = await self.get(db=db, id=id)
        if updated_job is None:
            raise ValueError("Failed to load updated job.")
        return updated_job

    async def delete(self, db: AsyncSession, id: uuid.UUID) -> None:
        """Force-delete a job and all dependent records by id."""
        await self.force_delete(db=db, id=id)
 
    async def force_delete(self, db: AsyncSession, id: uuid.UUID) -> None:
        """Force-delete a job and its related metadata, unlinking candidates."""
        job_exists = await db.scalar(select(Job.id).where(Job.id == id))
        if job_exists is None:
            return
 
        # 1. Delete transient data related to this job's interviews
        job_interview_ids = select(Interview.id).where(Interview.job_id == id)
        await db.execute(delete(Transcript).where(Transcript.interview_id.in_(job_interview_ids)))
        await db.execute(delete(Recording).where(Recording.interview_id.in_(job_interview_ids)))
        
        # 2. Delete core job-specific records
        await db.execute(delete(ResumeVersionResult).where(ResumeVersionResult.job_id == id))
        await db.execute(delete(HrDecision).where(HrDecision.job_id == id))
        await db.execute(delete(Interview).where(Interview.job_id == id))
        
        # 3. Cleanup Candidate stages for THIS job only
        job_stage_ids_subq = select(JobStageConfig.id).where(JobStageConfig.job_id == id)
        await db.execute(delete(CandidateStage).where(CandidateStage.job_stage_id.in_(job_stage_ids_subq)))
 
        # 4. Handle Cross-Job Matches
        # ONLY remove matches pointing TO this job (matched_job_id).
        # Matches originating FROM this job (original_job_id) should be PRESERVED
        # (The DB will set original_job_id to NULL automatically)
        await db.execute(
            delete(CrossJobMatch).where(CrossJobMatch.matched_job_id == id)
        )
 
        # 5. UNLINK candidates instead of deleting them
        # This preserves the Candidate profile, Resume, and File records for the Candidate Pool
        from sqlalchemy import update
        await db.execute(
            update(Candidate)
            .where(Candidate.applied_job_id == id)
            .values(applied_job_id=None)
        )
 
        # 6. Remove job-owned configuration and metadata
        await db.execute(delete(job_skills).where(job_skills.c.job_id == id))
        await db.execute(delete(JobStageConfig).where(JobStageConfig.job_id == id))
        await db.execute(delete(JobChunk).where(JobChunk.job_id == id))
        await db.execute(delete(JobVersion).where(JobVersion.job_id == id))
        await db.execute(delete(Job).where(Job.id == id))

        await db.commit()

    async def search(
        self,
        db: AsyncSession,
        query: str,
        skip: int = 0,
        limit: int = 100,
    ) -> dict[str, object]:
        """
        Search for jobs by title and description.

        Args:
            db (AsyncSession): Database session.
            query (str): The search query.
            skip (int): Number of records to skip.
            limit (int): Maximum number of records to return.

        Returns:
            dict[str, object]: A dictionary containing the matching jobs and total count.
        """
        from sqlalchemy import or_

        search_filter = or_(
            Job.title.ilike(f"%{query}%"),
            Job.jd_text.ilike(f"%{query}%"),
        )

        total_stmt = select(func.count()).select_from(Job).where(search_filter)
        total = await db.scalar(total_stmt)

        stmt = (
            select(Job)
            .options(
                selectinload(Job.skills),
                selectinload(Job.stages).selectinload(JobStageConfig.template),
                selectinload(Job.department),
                selectinload(Job.versions),
                selectinload(Job.associates),
            )
            .where(search_filter)
            .order_by(Job.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(stmt)
        return {
            "data": list(result.scalars().unique().all()),
            "total": total or 0,
        }

    async def get_version(self, db: AsyncSession, id: uuid.UUID) -> object | None:
        """
        Retrieve a specific JobVersion snapshot by its unique ID.
        """

        stmt = select(JobVersion).where(JobVersion.id == id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def _sync_skills(
        self, db: AsyncSession, job_id: uuid.UUID, skill_ids: list[uuid.UUID]
    ) -> None:
        """Replace a job's skill links with the provided skill ids and their default weightages."""
        await db.execute(delete(job_skills).where(job_skills.c.job_id == job_id))
        if not skill_ids:
            return

        # Fetch the default weightage for each skill
        from app.v1.db.models.skills import Skill
        from sqlalchemy import select
        skill_stmt = select(Skill.id, Skill.default_weightage).where(Skill.id.in_(skill_ids))
        skill_res = await db.execute(skill_stmt)
        skill_weights = {row[0]: row[1] or 10.0 for row in skill_res.fetchall()}

        await db.execute(
            insert(job_skills),
            [
                {
                    "job_id": job_id, 
                    "skill_id": skill_id, 
                    "weightage": skill_weights.get(skill_id, 10.0)
                } 
                for skill_id in skill_ids
            ],
        )

    async def _sync_associates(
        self, db: AsyncSession, job_id: uuid.UUID, associate_ids: list[uuid.UUID]
    ) -> None:
        """Replace a job's associate links with the provided associate ids."""
        from app.v1.db.models.job_associates import job_associates
        await db.execute(delete(job_associates).where(job_associates.c.job_id == job_id))
        if not associate_ids:
            return

        await db.execute(
            insert(job_associates),
            [
                {"job_id": job_id, "associate_id": associate_id}
                for associate_id in associate_ids
            ],
        )



    async def _sync_job_chunks(self, db: AsyncSession, job: Job) -> None:
        """Partition job description into chunks and persist with embeddings."""
        from app.v1.core.embeddings import embedding_service
        from app.v1.utils.text import split_into_chunks

        # Clear existing chunks
        await db.execute(delete(JobChunk).where(JobChunk.job_id == job.id))

        full_text = job.jd_text or ""
        if not full_text.strip():
            return

        chunks = split_into_chunks(full_text)
        if not chunks:
            return

        # Add Title as the first chunk for better context
        if job.title and job.title not in chunks[0]:
            chunks.insert(0, f"Job Title: {job.title}")

        chunk_records = []
        for text in chunks:
            embedding = embedding_service.encode_jd(text)
            chunk_records.append(
                JobChunk(
                    job_id=job.id,
                    chunk_text=text,
                    chunk_embedding=embedding,
                )
            )

        if chunk_records:
            db.add_all(chunk_records)
            await db.flush()


    async def get_titles(self, db: AsyncSession, query: str | None = None) -> list[dict[str, Any]]:
        """
        Retrieve only the IDs and titles of all jobs.
        
        Returns:
            list[dict[str, Any]]: A list of dictionaries with 'id' and 'title'.
        """
        stmt = select(Job.id, Job.title)
        if query:
            stmt = stmt.where(Job.title.ilike(f"%{query}%"))
        
        stmt = stmt.order_by(Job.created_at.desc())
        result = await db.execute(stmt)
        return [{"id": row.id, "title": row.title} for row in result.all()]

    async def get_titles_grouped(self, db: AsyncSession, query: str | None = None) -> list[dict[str, Any]]:
        """
        Retrieve active jobs grouped by title with their position variants.

        Returns a flat list of rows, each containing:
            job_id, title, position_id, position_name, is_active

        The caller (service layer) is responsible for grouping by title.
        """
        from app.v1.db.models.job_positions import JobPosition

        stmt = (
            select(
                Job.id.label("job_id"),
                Job.title,
                Job.position_id,
                JobPosition.name.label("position_name"),
                Job.is_active,
            )
            .join(JobPosition, Job.position_id == JobPosition.id)
            .where(Job.is_active.is_(True))
        )

        if query:
            stmt = stmt.where(Job.title.ilike(f"%{query}%"))

        stmt = stmt.order_by(Job.title, JobPosition.name)

        result = await db.execute(stmt)
        rows = result.all()

        return [
            {
                "job_id": row.job_id,
                "title": row.title,
                "position_id": row.position_id,
                "position_name": row.position_name,
                "is_active": row.is_active,
            }
            for row in rows
        ]


job_repository = JobRepository()
