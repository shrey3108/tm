"""
Resume upload repository module.

This module provides the data access layer for resume upload operations,
including candidate creation, file recording, and resume parsing summary storage.
"""

import logging
import uuid
from datetime import UTC, datetime

from fastcrud import FastCRUD
from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.v1.db.models.candidate_skills import candidate_skills
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.cover_letters import CoverLetter
from app.v1.db.models.files import File as FileRecord
from app.v1.db.models.job_skills import job_skills
from app.v1.db.models.jobs import Job
from app.v1.db.models.resume_chunks import ResumeChunk
from app.v1.db.models.resumes import Resume
from app.v1.db.models.skills import Skill
from app.v1.db.models.locations import Location
from app.v1.db.models.hr_decisions import HrDecision
from app.v1.db.models.interviews import Interview
from app.v1.db.models.cross_job_matches import CrossJobMatch
from app.v1.db.models.transcripts import Transcript
from app.v1.db.models.recordings import Recording
from app.v1.schemas.upload import ResumeRead, CandidateRead

_log = logging.getLogger(__name__)


class ResumeUploadRepository:
    """Repository for resume upload database operations.

    Provides methods for managing candidates, file records, and resume data
    during the resume screening process.
    """

    def __init__(self) -> None:
        """Initialize the ResumeUploadRepository with FastCRUD instances."""
        self.crud = FastCRUD(Resume, ResumeRead)
        self.candidate_crud = FastCRUD(Candidate, CandidateRead)

    # ------------------------------------------------------------------ #
    # Job
    # ------------------------------------------------------------------ #

    async def get_job(self, db: AsyncSession, job_id: uuid.UUID) -> Job | None:
        """Retrieve a job by its unique ID.

        Args:
            db: The async database session.
            job_id: The UUID of the job to retrieve.

        Returns:
            The job object if found, None otherwise.
        """
        return await db.get(Job, job_id)

    async def get_file_by_content_hash_for_job(
        self,
        db: AsyncSession,
        *,
        job_id: uuid.UUID,
        content_hash: str,
    ) -> FileRecord | None:
        """Find an existing file record for a job that matches the given content hash."""
        return await db.scalar(
            select(FileRecord)
            .join(Candidate, Candidate.id == FileRecord.candidate_id)
            .where(
                Candidate.applied_job_id == job_id,
                FileRecord.content_hash == content_hash,
            )
        )

    async def get_file_by_content_hash_global(
        self,
        db: AsyncSession,
        *,
        content_hash: str,
    ) -> FileRecord | None:
        """Find ANY existing file record in the database with this hash."""
        return await db.scalar(
            select(FileRecord)
            .where(FileRecord.content_hash == content_hash)
            .limit(1)
        )

    async def get_resume_by_text_hash_for_job(
        self,
        db: AsyncSession,
        *,
        job_id: uuid.UUID,
        text_hash: str,
        exclude_resume_id: uuid.UUID | None = None,
    ) -> Resume | None:
        """Find an existing, fully-processed resume for a job with the same extracted text.

        Used to detect when two files (e.g. pdf vs docx) contain identical content
        so the LLM analysis can be reused without re-running the expensive pipeline.

        Args:
            db: The async database session.
            job_id: The ID of the target job.
            text_hash: SHA-256 hex digest of the extracted resume text.
            exclude_resume_id: Optional resume ID to exclude from the search
                               (avoids matching the resume currently being processed).

        Returns:
            An existing processed Resume with the same text hash, or None.
        """
        query = (
            select(Resume)
            .join(Candidate, Candidate.id == Resume.candidate_id)
            .where(
                Candidate.applied_job_id == job_id,
                Resume.text_hash == text_hash,
                Resume.parsed.is_(True),
            )
        )
        if exclude_resume_id is not None:
            query = query.where(Resume.id != exclude_resume_id)
        return await db.scalar(query)

    async def get_candidate_for_job_and_email(
        self,
        self_db: AsyncSession,
        *,
        job_id: uuid.UUID,
        email: str,
    ) -> Candidate | None:
        """Get a candidate for a specific job by their email address.

        Args:
            db: The async database session.
            job_id: The ID of the job the candidate applied for.
            email: The candidate's email address.

        Returns:
            The candidate object if found, None otherwise.
        """
        return await self_db.scalar(
            select(Candidate).where(
                Candidate.applied_job_id == job_id,
                Candidate.email == email,
            )
        )

    async def create_candidate(
        self,
        db: AsyncSession,
        *,
        job_id: uuid.UUID,
        email: str,
        first_name: str | None,
        last_name: str | None,
    ) -> Candidate:
        """Create a new candidate record.

        Args:
            db: The async database session.
            job_id: The ID of the job being applied for.
            email: The candidate's email address.
            first_name: The candidate's first name.
            last_name: The candidate's last name.

        Returns:
            The newly created candidate object.
        """
        candidate = Candidate(
            first_name=first_name,
            last_name=last_name,
            email=email,
            applied_job_id=job_id,
            current_status="applied",
        )
        db.add(candidate)
        await db.flush()
        return candidate

    async def create_file_record(
        self,
        db: AsyncSession,
        *,
        owner_id: uuid.UUID,
        candidate_id: uuid.UUID,
        file_name: str,
        file_type: str,
        source_url: str,
        size: int,
        content_hash: str | None = None,
    ) -> FileRecord:
        """Create a new file record for an uploaded resume.

        Args:
            db: The async database session.
            owner_id: The ID of the user who owns the file.
            candidate_id: The ID of the candidate the file belongs to.
            file_name: The name of the file.
            file_type: The MIME type or extension of the file.
            source_url: The URL or path where the file is stored.
            size: The size of the file in bytes.
            content_hash: Optional SHA-256 hex digest of the file bytes.

        Returns:
            The newly created file record object.
        """
        file_record = FileRecord(
            owner_id=owner_id,
            candidate_id=candidate_id,
            file_name=file_name,
            file_type=file_type,
            source_url=source_url,
            size=size,
            content_hash=content_hash,
        )
        db.add(file_record)
        await db.flush()
        return file_record

    async def create_resume_record(
        self,
        db: AsyncSession,
        *,
        candidate_id: uuid.UUID,
        file_id: uuid.UUID,
        parse_summary: dict[str, object],
        parsed: bool = True,
        resume_score: float | None = None,
        pass_fail: str | None = None,
    ) -> Resume:
        """Create a new resume record with parsing summary.

        Args:
            db: The async database session.
            candidate_id: The ID of the candidate.
            file_id: The ID of the associated file record.
            parse_summary: A dictionary containing the extracted summary data.

        Returns:
            The newly created resume record object.
        """
        resume_record = Resume(
            candidate_id=candidate_id,
            file_id=file_id,
            parsed=parsed,
            parse_summary=parse_summary,
            resume_score=resume_score,
            pass_fail=pass_fail,
        )
        db.add(resume_record)
        await db.flush()
        return resume_record

    async def create_resume_chunk(
        self,
        db: AsyncSession,
        *,
        resume_id: uuid.UUID,
        parsed_json: dict[str, object],
        raw_text: str,
        chunk_embedding: list[float] | None = None,
    ) -> None:
        """Create a new resume chunk for detailed extraction data.

        Args:
            db: The async database session.
            resume_id: The ID of the associated resume record.
            parsed_json: The detailed structured data from the resume.
            raw_text: The full raw text extracted from the resume.
        """
        db.add(
            ResumeChunk(
                resume_id=resume_id,
                parsed_at=datetime.now(UTC),
                parsed_json=parsed_json,
                raw_text=raw_text,
                chunk_embedding=chunk_embedding,
            )
        )

    async def update_candidate_profile(
        self,
        db: AsyncSession,
        *,
        candidate: Candidate,
        first_name: str | None = None,
        last_name: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        location: str | None = None,
        info: dict[str, object],
        info_embedding: list[float] | None = None,
    ) -> Candidate:
        """Update a candidate's profile information.

        Args:
            db: The async database session.
            candidate: The candidate object to update.
            first_name: Updated first name.
            last_name: Updated last name.
            email: Updated email address.
            phone: Updated phone number.
            info: A dictionary containing additional candidate information.
            info_embedding: Vector embedding of candidate info.

        Returns:
            The updated candidate object.
        """
        if first_name is not None and first_name != "Parsing...":
            candidate.first_name = first_name
        elif first_name is None and candidate.first_name == "Parsing...":
            candidate.first_name = None

        if last_name is not None:
            candidate.last_name = last_name

        if email:
            candidate.email = email
        elif email is None and (candidate.email is None or "pending_" in (candidate.email or "")):
            # Clear placeholder or keep as None if no new email found
            candidate.email = None

        if phone and not candidate.phone:
            candidate.phone = phone

        if location is not None:
            # Normalize and get-or-create Location row
            loc_name = location.strip().title()
            if loc_name and loc_name.lower() not in ("not mentioned", "null", "none", "unknown", "n/a"):
                loc_obj = await db.scalar(
                    select(Location).where(func.lower(Location.name) == loc_name.lower())
                )
                if loc_obj is None:
                    loc_obj = Location(name=loc_name)
                    db.add(loc_obj)
                    await db.flush()
                candidate.location_id = loc_obj.id
            else:
                candidate.location_id = None

        candidate.info = info
        candidate.info_embedding = info_embedding
        await db.flush()
        return candidate

    async def get_job_skills(
        self,
        db: AsyncSession,
        *,
        job_id: uuid.UUID,
    ) -> list[Skill]:
        """Retrieve all skills associated with a specific job.

        Args:
            db: The async database session.
            job_id: The UUID of the job.

        Returns:
            A list of Skill objects.
        """
        return list(
            (
                await db.scalars(
                    select(Skill)
                    .join(job_skills, job_skills.c.skill_id == Skill.id)
                    .where(job_skills.c.job_id == job_id)
                )
            ).all()
        )

    async def get_resume_for_job(
        self,
        db: AsyncSession,
        *,
        job_id: uuid.UUID,
        resume_id: uuid.UUID,
        owner_id: uuid.UUID | None = None,
    ) -> Resume | None:
        """Retrieve a specific resume record for a job, with optional ownership check.

        Uses selectinload for candidate and file to prevent lazy-loading errors.

        Args:
            db: The async database session.
            job_id: The UUID of the job.
            resume_id: The UUID of the resume.
            owner_id: Optional UUID of the user who owns the file.

        Returns:
            The Resume object if found, None otherwise.
        """
        query = (
            select(Resume)
            .options(
                selectinload(Resume.candidate),
                selectinload(Resume.file),
                selectinload(Resume.version_results),
            )
            .where(
                Resume.id == resume_id,
            )
        )
        if owner_id is not None:
            query = query.join(FileRecord, FileRecord.id == Resume.file_id).where(
                FileRecord.owner_id == owner_id
            )
        return await db.scalar(query)

    async def resume_exists(self, db: AsyncSession, resume_id: uuid.UUID) -> bool:
        """Check if a resume record exists in the database.

        Args:
            db: The async database session.
            resume_id: The UUID of the resume.

        Returns:
            True if it exists, False otherwise.
        """
        return (
            await db.scalar(select(func.count(Resume.id)).where(Resume.id == resume_id))
        ) > 0

    async def mark_resume_failed(
        self,
        db: AsyncSession,
        *,
        resume_id: uuid.UUID,
        parse_summary: dict[str, object],
    ) -> None:
        """Mark a resume as failed in the database.

        Args:
            db: The async database session.
            resume_id: The UUID of the resume.
            parse_summary: A dictionary containing error details and status.
        """
        await db.execute(
            update(Resume)
            .where(Resume.id == resume_id)
            .values(
                parsed=False,
                parse_summary=parse_summary,
                resume_score=None,
                pass_fail=None,
            )
        )

    async def update_job_embedding(
        self,
        db: AsyncSession,
        *,
        job: Job,
        embedding: list[float],
    ) -> None:
        """Update the vector embedding for a job's description.

        Args:
            db: The async database session.
            job: The Job object to update.
            embedding: The vector embedding list.
        """
        job.jd_embedding = embedding
        await db.flush()

    async def update_skill_embeddings(
        self,
        db: AsyncSession,
        *,
        embeddings_by_skill_id: dict[uuid.UUID, list[float]],
    ) -> None:
        """Update vector embeddings for multiple skills.

        Args:
            db: The async database session.
            embeddings_by_skill_id: A dictionary mapping skill IDs to their embeddings.
        """
        if not embeddings_by_skill_id:
            return

        skills = (
            await db.scalars(
                select(Skill).where(Skill.id.in_(list(embeddings_by_skill_id)))
            )
        ).all()
        for skill in skills:
            skill.skill_embedding = embeddings_by_skill_id[skill.id]
        await db.flush()

    async def sync_candidate_skills(
        self,
        db: AsyncSession,
        *,
        candidate_id: uuid.UUID,
        skill_names: list[str],
    ) -> list[Skill]:
        """Synchronize a candidate's skills against the existing skill catalog.

        Args:
            db: The async database session.
            candidate_id: The ID of the candidate.
            skill_names: A list of extracted skill names to associate with the
                candidate when matching skills already exist in the catalog.
        """
        if not skill_names:
            return []

        normalized_skill_names = {
            skill_name.strip().lower()
            for skill_name in skill_names
            if skill_name.strip()
        }
        if not normalized_skill_names:
            return []

        matched_skills = (
            await db.scalars(
                select(Skill).where(func.lower(Skill.name).in_(normalized_skill_names))
            )
        ).all()
        matched_skill_ids = {skill.id for skill in matched_skills}

        existing_links = await db.execute(
            select(candidate_skills.c.skill_id).where(
                candidate_skills.c.candidate_id == candidate_id
            )
        )
        linked_skill_ids = {row[0] for row in existing_links}

        stale_skill_ids = linked_skill_ids - matched_skill_ids
        if stale_skill_ids:
            await db.execute(
                delete(candidate_skills).where(
                    candidate_skills.c.candidate_id == candidate_id,
                    candidate_skills.c.skill_id.in_(stale_skill_ids),
                )
            )

        rows_to_insert = [
            {"candidate_id": candidate_id, "skill_id": skill.id}
            for skill in matched_skills
            if skill.id not in linked_skill_ids
        ]
        if rows_to_insert:
            await db.execute(insert(candidate_skills), rows_to_insert)
        return list(matched_skills)

    async def get_candidates_for_job(
        self,
        db: AsyncSession,
        *,
        job_id: uuid.UUID,
    ) -> list[Candidate]:
        """Get all candidates for a specific job with their resumes.

        Args:
            db: The async database session.
            job_id: The ID of the job.

        Returns:
            A list of candidate objects with their resumes.
        """
        return list(
            (
                await db.scalars(
                    select(Candidate)
                    .options(
                        selectinload(Candidate.resumes).selectinload(Resume.file),
                        selectinload(Candidate.resumes).selectinload(Resume.version_results),
                        selectinload(Candidate.hr_decisions),
                    )
                    .where(
                        Candidate.applied_job_id == job_id,
                        Candidate.resumes.any(),
                    )
                    .order_by(Candidate.created_at.desc())
                )
            ).all()
        )

    async def get_resume_full_text(self, db: AsyncSession, resume_id: uuid.UUID) -> str:
        """Fetch and combine all raw_text from ResumeChunks for a given resume_id."""
        from app.v1.db.models.resume_chunks import ResumeChunk
        stmt = (
            select(ResumeChunk.raw_text)
            .where(ResumeChunk.resume_id == resume_id)
            .order_by(ResumeChunk.id.asc()) # Assuming UUID7 order is chronological
        )
        result = await db.execute(stmt)
        chunks = result.scalars().all()
        return "\n\n".join([c for c in chunks if c])

    async def get_resumes_for_job(
        self,
        db: AsyncSession,
        *,
        job_id: uuid.UUID,
    ) -> list[Resume]:
        """Retrieve all resume records for a specific job, ordered by upload date.

        Args:
            db: The async database session.
            job_id: The UUID of the job.

        Returns:
            A list of Resume objects.
        """
        # Using stable SQLAlchemy query with selectinload to ensure relations are available
        query = (
            select(Resume)
            .join(Candidate, Resume.candidate_id == Candidate.id)
            .options(
                selectinload(Resume.candidate),
                selectinload(Resume.file),
            )
            .where(Candidate.applied_job_id == job_id)
            .order_by(Resume.uploaded_at.desc())
        )
        return list((await db.scalars(query)).all())

    async def commit(self, db: AsyncSession) -> None:
        """Commit the current transaction.

        Args:
            db: The async database session.
        """
        await db.commit()

    async def flush(self, db: AsyncSession) -> None:
        """Flush the current session changes to the database.

        Args:
            db: The async database session.
        """
        await db.flush()

    async def rollback(self, db: AsyncSession) -> None:
        """Roll back the current transaction.

        Args:
            db: The async database session.
        """
        await db.rollback()

    async def get_resume_full_text(self, db: AsyncSession, resume_id: uuid.UUID) -> str:
        """Fetch and concatenate all raw text chunks for a specific resume.

        Args:
            db: The async database session.
            resume_id: UUID of the resume to retrieve text for.

        Returns:
            Concatenated raw text from all chunks. Empty string if no chunks found.
        """
        chunks = (
            await db.scalars(
                select(ResumeChunk.raw_text)
                .where(ResumeChunk.resume_id == resume_id)
                .order_by(ResumeChunk.id.asc())
            )
        ).all()
        return "\n\n".join(chunks).strip()

    async def refresh_file_and_resume(
        self,
        db: AsyncSession,
        *,
        file_record: FileRecord,
        resume_record: Resume,
    ) -> None:
        """Refresh the state of file and resume records from the database.

        Args:
            db: The async database session.
            file_record: The file record object to refresh.
            resume_record: The resume record object to refresh.
        """
        await db.refresh(file_record)
        await db.refresh(resume_record)

    async def delete_resume(
        self,
        db: AsyncSession,
        *,
        resume_id: uuid.UUID,
        job_id: uuid.UUID,
    ) -> bool:
        """
        Delete a resume or candidate from a specific job.
        Preserves the candidate if they are matched to other jobs.
        """
        # 1. Look for the candidate and their link to this job
        candidate = await db.scalar(
            select(Candidate)
            .options(selectinload(Candidate.resumes))
            .where(
                (Candidate.applied_job_id == job_id) | 
                (Candidate.id.in_(select(CrossJobMatch.candidate_id).where(CrossJobMatch.matched_job_id == job_id)))
            )
            .distinct()
        )
        if not candidate:
            return False

        candidate_id = candidate.id

        # 2. Check if the candidate is needed elsewhere (other cross-matches)
        other_matches_count = await db.scalar(
            select(func.count(CrossJobMatch.id)).where(
                (CrossJobMatch.candidate_id == candidate_id) & (CrossJobMatch.matched_job_id != job_id)
            )
        ) or 0
        
        # Also check if they are the primary applicant for a DIFFERENT job (unlikely here but safe)
        is_primary_elsewhere = (candidate.applied_job_id is not None and candidate.applied_job_id != job_id)

        should_keep_profile = (other_matches_count > 0) or is_primary_elsewhere

        # 3. Cleanup job-specific data
        # Decisions for this job only
        await db.execute(delete(HrDecision).where(HrDecision.candidate_id == candidate_id, HrDecision.job_id == job_id))
        
        # Interviews for this job only (and their transients)
        job_interview_ids = select(Interview.id).where(Interview.candidate_id == candidate_id, Interview.job_id == job_id)
        await db.execute(delete(Transcript).where(Transcript.interview_id.in_(job_interview_ids)))
        await db.execute(delete(Recording).where(Recording.interview_id.in_(job_interview_ids)))
        await db.execute(delete(Interview).where(Interview.candidate_id == candidate_id, Interview.job_id == job_id))

        # Cross-job match entry for THIS job
        await db.execute(delete(CrossJobMatch).where(CrossJobMatch.candidate_id == candidate_id, CrossJobMatch.matched_job_id == job_id))

        # Unlink if they were the primary applicant for this job
        if candidate.applied_job_id == job_id:
            candidate.applied_job_id = None
            await db.flush()

        # 4. Final Decision: Delete or Keep?
        if should_keep_profile:
            # We keep the Candidate, Resumes, and Files because they are used elsewhere
            await db.commit()
        else:
            # Hard delete if this was their only job
            # Delete resume chunks
            resume_ids_subq = select(Resume.id).where(Resume.candidate_id == candidate_id)
            await db.execute(delete(ResumeChunk).where(ResumeChunk.resume_id.in_(resume_ids_subq)))
            
            # Delete resumes and files
            await db.execute(delete(Resume).where(Resume.candidate_id == candidate_id))
            await db.execute(delete(FileRecord).where(FileRecord.candidate_id == candidate_id))
            await db.execute(delete(CoverLetter).where(CoverLetter.candidate_id == candidate_id))
            await db.execute(delete(candidate_skills).where(candidate_skills.c.candidate_id == candidate_id))
            
            # Delete the person
            await db.delete(candidate)
            await db.commit()

        # Invalidate cache for the job after successful deletion
        try:
            from app.v1.services.admin.system_service import system_service
            await system_service.invalidate_job_cache(job_id)
        except Exception:
            pass

        return True


resume_upload_repository = ResumeUploadRepository()
