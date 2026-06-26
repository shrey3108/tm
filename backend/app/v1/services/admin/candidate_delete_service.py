"""
Candidate deletion service.

Extracted from candidate_service.py to keep file sizes manageable.
Handles candidate deletion with manual cleanup of related records
(interviews, transcripts, recordings, resume_chunks), cache invalidation
and audit logging.
"""
import uuid

from sqlalchemy import select, delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.models.candidates import Candidate
from app.v1.db.models.resumes import Resume
from app.v1.services.admin.audit_service import audit_service


class CandidateDeleteService:
    """
    Service for deleting candidates and cleaning up related data.
    """

    async def delete_candidate_by_identifier(
        self, db: AsyncSession, admin_user_id: uuid.UUID, identifier: str
    ) -> bool:
        """
        Delete a candidate by ID or Email for testing purposes.
        """
        # Try to parse identifier as UUID
        candidate_id = None
        try:
            candidate_id = uuid.UUID(identifier)
        except ValueError:
            pass

        if candidate_id:
            stmt = select(Candidate).where(Candidate.id == candidate_id)
        else:
            stmt = select(Candidate).where(Candidate.email == identifier)

        result = await db.execute(stmt)
        candidate = result.scalar_one_or_none()

        if not candidate:
            return False

        # 1. Manually cleanup interview-related data first (Evaluation -> Transcript -> Recording -> Interview)
        # This is necessary because Transcripts reference Files, and Files are cascaded from Candidate.
        from app.v1.db.models.interviews import Interview
        from app.v1.db.models.transcripts import Transcript
        from app.v1.db.models.evaluations import Evaluation
        from app.v1.db.models.recordings import Recording

        # Get all interview IDs for this candidate
        interview_ids_stmt = select(Interview.id).where(Interview.candidate_id == candidate.id)
        interview_ids_res = await db.execute(interview_ids_stmt)
        interview_ids = [row[0] for row in interview_ids_res.all()]

        if interview_ids:
            # Delete Evaluations linked to these interviews
            await db.execute(delete(Evaluation).where(Evaluation.interview_id.in_(interview_ids)))
            # Delete Transcripts linked to these interviews
            await db.execute(delete(Transcript).where(Transcript.interview_id.in_(interview_ids)))
            # Delete Recordings linked to these interviews
            await db.execute(delete(Recording).where(Recording.interview_id.in_(interview_ids)))
            # Delete the Interviews themselves
            await db.execute(delete(Interview).where(Interview.id.in_(interview_ids)))

        # 2. Manually delete resume_chunks (no cascade in DB constraint)
        resume_ids_result = await db.execute(
            select(Resume.id).where(Resume.candidate_id == candidate.id)
        )
        resume_ids = [row[0] for row in resume_ids_result.all()]
        if resume_ids:
            await db.execute(
                text("DELETE FROM resume_chunks WHERE resume_id = ANY(:ids)"),
                {"ids": resume_ids}
            )

        # Capture candidate info before deletion for audit trail
        candidate_name = f"{candidate.first_name or ''} {candidate.last_name or ''}"
        candidate_email = candidate.email
        applied_job_id = candidate.applied_job_id

        await db.delete(candidate)
        await db.commit()

        # Invalidate cache immediately after candidate deletion
        try:
            from app.v1.core.cache import cache
            await cache.clear(pattern="candidates:*")
            if applied_job_id:
                from app.v1.services.admin.system_service import system_service
                await system_service.invalidate_job_cache(applied_job_id)
        except Exception:
            pass

        # Audit log for candidate deletion
        await audit_service.log_action(
            db=db,
            user_id=admin_user_id,
            action="delete_candidate",
            target_type="candidate",
            target_id=candidate_id,
            details={
                "name": candidate_name,
                "email": candidate_email,
                "job_id": str(applied_job_id) if applied_job_id else None
            }
        )
        return True


candidate_delete_service = CandidateDeleteService()
