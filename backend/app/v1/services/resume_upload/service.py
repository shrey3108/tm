"""
Main resume upload service orchestrator.
"""

from __future__ import annotations

import hashlib
import time
import uuid
from pathlib import Path
from app.v1.utils.uuid import UUIDHelper

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.cross_job_matches import CrossJobMatch
from app.v1.db.models.resumes import Resume
from app.v1.db.models.hr_decisions import HrDecision

from app.v1.core.config import settings
from app.v1.core.storage import resolve_storage_path, to_storage_relative_path
from app.v1.repository.job_repository import job_repository
from app.v1.repository.resume_upload_repository import resume_upload_repository
from app.v1.schemas.job import JobRead
from app.v1.schemas.upload import (
    CandidateResponse,
    JobCandidatesResponse,
    JobResumesResponse,
    ResumeMatchAnalysis,
    ResumeStatusResponse,
    ResumeUploadResponse,
)
from app.v1.schemas.user import UserRead

from .background import BackgroundProcessor
from .converters import (
    job_resume_response_from_resume,
    merge_processing_info,
    status_response_from_resume,
    upload_response_from_records,
)
from .logging import logger as _log, log_event, log_stage
from .processor import ResumeProcessor
from app.v1.services.candidate_stage_service import candidate_stage_service


class ResumeUploadService:
    """Service for handling resume upload and processing."""

    def __init__(self) -> None:
        self.processor = ResumeProcessor()
        self.background = BackgroundProcessor(self.processor)

    async def upload_resume_for_job(
        self,
        *,
        db: AsyncSession,
        job_id: uuid.UUID,
        resume: UploadFile,
        current_user: UserRead,
    ) -> ResumeUploadResponse:
        """Handle the initial upload of a resume.

        Validates the file, saves it, creates initial database records,
        and schedules background processing.
        """
        total_started_at = time.perf_counter()
        log_event(
            event="upload_received",
            job_id=job_id,
            user_id=current_user.id,
            file_name=resume.filename,
        )

        stage_started_at = time.perf_counter()
        job = await job_repository.get(db, job_id)
        log_stage(
            stage="upload_load_job",
            started_at=stage_started_at,
            job_id=job_id,
        )
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found.",
            )

        if not job.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Job is not accepting resumes.",
            )

        if not resume.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Resume filename is required.",
            )

        extension = Path(resume.filename).suffix.lower().lstrip(".")
        if extension not in settings.ALLOWED_RESUME_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Only the following file types are allowed: "
                    f"{', '.join(settings.ALLOWED_RESUME_EXTENSIONS)}."
                ),
            )

        stage_started_at = time.perf_counter()
        content = await resume.read()
        file_size = len(content)
        log_stage(
            stage="upload_read_file",
            started_at=stage_started_at,
            job_id=job_id,
            file_size=file_size,
        )
        max_size_bytes = settings.RESUME_MAX_SIZE_MB * 1024 * 1024
        if file_size > max_size_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Resume size must be <= {settings.RESUME_MAX_SIZE_MB} MB.",
            )

        content_hash = hashlib.sha256(content).hexdigest()
        
        # 1. Global Deduplication Check
        existing_global_file = await resume_upload_repository.get_file_by_content_hash_global(
            db, content_hash=content_hash
        )
        
        candidate = None
        existing_resume_id = None
        if existing_global_file and existing_global_file.candidate_id:
            # Re-use existing candidate
            candidate = await db.get(Candidate, existing_global_file.candidate_id)
            if candidate:
                _log.info(f"Re-using existing candidate {candidate.id} for global hash match {content_hash}")
                
                # Check if they are already in THIS job pool (Applied or Matched)
                if candidate.applied_job_id == job_id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="This resume has already been uploaded for this job.",
                    )
            
            existing_xm = await db.execute(
                select(CrossJobMatch.id).where(
                    CrossJobMatch.candidate_id == candidate.id,
                    CrossJobMatch.matched_job_id == job_id
                )
            )
            if existing_xm.scalar_one_or_none():
                 raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This candidate is already linked to this job.",
                )
            
            # Find the resume record for this file (only fully parsed ones)
            resume_stmt = select(Resume.id).where(Resume.file_id == existing_global_file.id, Resume.parsed == True)
            existing_resume_id = (await db.execute(resume_stmt)).scalar()

            # Link existing candidate to this new job via CrossJobMatch
            new_xm = CrossJobMatch(
                candidate_id=candidate.id,
                matched_job_id=job_id,
                resume_id=existing_resume_id,
                match_score=0.0, # Will be updated by processor
                match_analysis={}
            )
            db.add(new_xm)

            # Check if this candidate is already PASSED/APPROVED for any other job
            approval_stmt = select(HrDecision.id).where(
                HrDecision.candidate_id == candidate.id,
                HrDecision.decision.ilike("pass")
            ).limit(1)
            is_already_hired = (await db.execute(approval_stmt)).scalar()
            
            if is_already_hired:
                _log.info(f"Candidate {candidate.id} already passed elsewhere. Auto-failing for new job {job_id}")
                auto_reject = HrDecision(
                    candidate_id=candidate.id,
                    job_id=job_id,
                    user_id=current_user.id,
                    decision="fail",
                    notes="Selected for another job"
                )
                db.add(auto_reject)

            # Initialize hiring pipeline stages for this candidate-job link if not already present
            await candidate_stage_service.initiate_candidate_pipeline(db, candidate.id, job_id)
            
            await db.flush()
        else:
            candidate = Candidate(
                first_name="Parsing...",
                last_name="",
                applied_job_id=job_id,
                applied_version_number=job.version,
                email=f"pending_{UUIDHelper.generate_uuid7()}@processing.local",
                info={},
            )
            db.add(candidate)
            await db.flush()

        log_stage(
            stage="upload_ensure_candidate",
            started_at=stage_started_at,
            job_id=job_id,
            candidate_id=candidate.id if candidate else None,
        )

        upload_root = resolve_storage_path(settings.RESUME_UPLOAD_DIR)
        target_dir = upload_root / str(job_id) / content_hash
        target_dir.mkdir(parents=True, exist_ok=True)

        _log.info(f"Uploading resume: job_id={job_id}, content_hash={content_hash}")

        stored_file_name = f"{UUIDHelper.generate_uuid7()}.{extension}"
        target_path = target_dir / stored_file_name
        stored_file_path = to_storage_relative_path(target_path)
        stage_started_at = time.perf_counter()
        target_path.write_bytes(content)
        log_stage(
            stage="upload_store_file",
            started_at=stage_started_at,
            job_id=job_id,
            candidate_id=candidate.id if candidate else None,
            path=stored_file_path,
        )

        stage_started_at = time.perf_counter()
        file_record = await resume_upload_repository.create_file_record(
            db,
            owner_id=current_user.id,
            candidate_id=candidate.id if candidate else None,
            file_name=resume.filename,
            file_type=extension,
            source_url=stored_file_path,
            size=file_size,
            content_hash=content_hash,
        )
        log_stage(
            stage="upload_create_file_record",
            started_at=stage_started_at,
            job_id=job_id,
            candidate_id=candidate.id if candidate else None,
            file_id=file_record.id,
        )

        stage_started_at = time.perf_counter()
        resume_record = await resume_upload_repository.create_resume_record(
            db,
            candidate_id=candidate.id if candidate else None,
            file_id=file_record.id,
            parse_summary=merge_processing_info(None, status_value="processing"),
            parsed=False,
            resume_score=None,
            pass_fail=None,
        )
        log_stage(
            stage="upload_create_resume_record",
            started_at=stage_started_at,
            job_id=job_id,
            candidate_id=candidate.id if candidate else None,
            resume_id=resume_record.id,
        )

        stage_started_at = time.perf_counter()
        await resume_upload_repository.commit(db)
        
        # Clear cache immediately so 'Parsing...' placeholder shows up without delay
        try:
            from app.v1.core.cache import cache
            jid_str = str(job_id)
            await cache.clear(pattern=f"candidates:for_job:{jid_str}*")
            await cache.delete(f"job_stats:{jid_str}")
            _log.info(f"Cleared cache for job {jid_str} after upload")
        except Exception as cache_err:
            _log.error(f"Cache clear failed after upload: {cache_err}")

        await resume_upload_repository.refresh_file_and_resume(
            db,
            file_record=file_record,
            resume_record=resume_record,
        )
        log_stage(
            stage="upload_commit_and_refresh",
            started_at=stage_started_at,
            job_id=job_id,
            candidate_id=candidate.id if candidate else None,
            resume_id=resume_record.id,
        )

        self.background.schedule_processing(
            job_id=job_id,
            resume_id=resume_record.id,
            file_path=stored_file_path,
            existing_resume_id=existing_resume_id if existing_global_file else None,
        )
        log_stage(
            stage="upload_total",
            started_at=total_started_at,
            job_id=job_id,
            candidate_id=candidate.id if candidate else None,
            resume_id=resume_record.id,
        )

        return upload_response_from_records(
            job_id=job_id,
            candidate_id=candidate.id if candidate else None,
            file_record=file_record,
            resume_record=resume_record,
        )

    async def get_resume_status(
        self,
        *,
        db: AsyncSession,
        job_id: uuid.UUID,
        resume_id: uuid.UUID,
        current_user: UserRead,
    ) -> ResumeStatusResponse:
        """Retrieve the current status and analysis for a specific resume."""
        resume_record = await resume_upload_repository.get_resume_for_job(
            db,
            job_id=job_id,
            resume_id=resume_id,
            owner_id=current_user.id,
        )
        if resume_record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resume not found.",
            )
        return status_response_from_resume(
            job_id=job_id,
            resume_record=resume_record,
        )

    async def get_candidates_for_job(
        self,
        *,
        db: AsyncSession,
        job_id: uuid.UUID,
    ) -> JobCandidatesResponse:
        """Retrieve all candidates for a job with their resume insights."""
        job = await resume_upload_repository.get_job(db, job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found.",
            )

        candidates = await resume_upload_repository.get_candidates_for_job(
            db, job_id=job_id
        )

        candidate_responses = []
        for candidate in candidates:
            # 1. Get latest resume
            resumes = getattr(candidate, "resumes", [])
            latest_resume = (
                max(resumes, key=lambda resume: resume.uploaded_at) if resumes else None
            )

            # 2. Setup defaults
            location = candidate.location_name
            if not location and candidate.info and isinstance(candidate.info, dict):
                loc_val = candidate.info.get("location")
                if isinstance(loc_val, str) and loc_val.strip().lower() not in (
                    "not mentioned",
                    "null",
                    "none",
                ):
                    location = loc_val.strip()
                elif isinstance(loc_val, list) and loc_val:
                    for entry in loc_val:
                        t = ""
                        if isinstance(entry, dict):
                            t = entry.get("text") or entry.get("location") or ""
                        else:
                            t = str(entry)

                        if t and t.strip().lower() not in (
                            "not mentioned",
                            "null",
                            "none",
                        ):
                            location = t.strip()
                            break
            linkedin_url = None
            github_url = None
            analysis = None
            is_parsed = False
            resume_score = None
            pass_fail = None
            processing_status = None
            processing_error = None
            hr_decision = None

            # 3. Get latest HR Decision
            if candidate.hr_decisions:
                latest_hr_decision = max(
                    candidate.hr_decisions, key=lambda d: d.decided_at
                )
                hr_decision = latest_hr_decision.decision

            # 4. Extract data from latest resume (if any)
            if latest_resume:
                is_parsed = bool(latest_resume.parsed)
                resume_score = latest_resume.resume_score
                pass_fail = latest_resume.pass_fail
                parse_summary = latest_resume.parse_summary or {}

                # Processing status
                p_info = parse_summary.get("processing", {})
                if isinstance(p_info, dict):
                    processing_status = p_info.get("status")
                    processing_error = p_info.get("error")

                # Analysis
                a_payload = parse_summary.get("analysis")
                if isinstance(a_payload, dict):
                    analysis = ResumeMatchAnalysis.model_validate(a_payload)

                # Social links and location from source data
                # (Pattern matched from CandidateAdminService)
                search_sources = [parse_summary]
                if "source_data" in parse_summary:
                    search_sources.append(parse_summary["source_data"])
                if "extracted_data" in parse_summary:
                    search_sources.append(parse_summary["extracted_data"])

                for src in search_sources:
                    if not isinstance(src, dict):
                        continue

                    # Location
                    if not location:
                        loc_val = src.get("location")
                        if loc_val:
                            if isinstance(
                                loc_val, str
                            ) and loc_val.strip().lower() not in (
                                "not mentioned",
                                "null",
                                "none",
                            ):
                                location = loc_val.strip()
                            elif isinstance(loc_val, list) and loc_val:
                                for entry in loc_val:
                                    t = ""
                                    if isinstance(entry, dict):
                                        t = (
                                            entry.get("text")
                                            or entry.get("location")
                                            or ""
                                        )
                                    else:
                                        t = str(entry)

                                    if t and t.strip().lower() not in (
                                        "not mentioned",
                                        "null",
                                        "none",
                                    ):
                                        location = t.strip()
                                        break

                    # Social Links
                    links = src.get("links") or src.get("social_links")
                    if links:
                        link_list = (
                            [l.strip() for l in links.split(";") if l.strip()]
                            if isinstance(links, str)
                            else (links if isinstance(links, list) else [])
                        )
                        for u in link_list:
                            u_str = (
                                (u.get("url") or u.get("text") or "")
                                if isinstance(u, dict)
                                else (str(u) if u else "")
                            )
                            if not u_str or not isinstance(u_str, str):
                                continue
                            ul = u_str.lower()
                            if "linkedin.com" in ul and not linkedin_url:
                                linkedin_url = u_str
                            elif "github.com" in ul and not github_url:
                                github_url = u_str

            # 4b. Get version history
            version_results = None
            if latest_resume and hasattr(latest_resume, "version_results") and latest_resume.version_results:
                version_results = [
                    {
                        "id": str(vr.id),
                        "resume_id": str(vr.resume_id),
                        "job_id": str(vr.job_id),
                        "job_version_number": vr.job_version_number,
                        "resume_score": float(vr.resume_score) if vr.resume_score is not None else None,
                        "pass_fail": vr.pass_fail,
                        "analysis_data": vr.analysis_data,
                        "analyzed_at": vr.analyzed_at.isoformat() if vr.analyzed_at else None,
                    }
                    for vr in latest_resume.version_results
                ]

            # 5. Append response
            candidate_responses.append(
                CandidateResponse(
                    id=candidate.id,
                    first_name=candidate.first_name,
                    last_name=candidate.last_name,
                    email=candidate.email,
                    phone=candidate.phone,
                    location=location,
                    linkedin_url=linkedin_url,
                    github_url=github_url,
                    current_status=candidate.current_status,
                    created_at=candidate.created_at,
                    applied_job_id=candidate.applied_job_id,
                    resume_id=latest_resume.id if latest_resume else None,
                    applied_version_number=candidate.applied_version_number,
                    resume_analysis=analysis,
                    resume_score=resume_score,
                    pass_fail=pass_fail,
                    is_parsed=is_parsed,
                    processing_status=processing_status,
                    processing_error=processing_error,
                    hr_decision=hr_decision,
                    version_results=version_results,
                )
            )

        return JobCandidatesResponse(job_id=job_id, candidates=candidate_responses)

    async def get_resumes_for_job(
        self,
        *,
        db: AsyncSession,
        job_id: uuid.UUID,
    ) -> JobResumesResponse:
        """Retrieve all resumes uploaded for a specific job."""
        job = await job_repository.get(db, job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job not found."
            )

        resumes = await resume_upload_repository.get_resumes_for_job(db, job_id=job_id)
        return JobResumesResponse(
            job_id=job_id,
            job=JobRead.model_validate(job),
            resumes=[
                job_resume_response_from_resume(job_id=job_id, resume_record=r)
                for r in resumes
            ],
        )

    async def trigger_mass_refresh(
        self,
        *,
        db: AsyncSession,
        job_id: uuid.UUID,
        background_tasks,
    ) -> None:
        """Trigger a background refresh for all resumes in a job."""
        job = await job_repository.get(db, job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job not found."
            )

        bg_processor = BackgroundProcessor(ResumeProcessor())
        bg_processor.schedule_mass_refresh(job_id=job_id)

    async def trigger_candidate_reanalyze(
        self,
        *,
        db: AsyncSession,
        job_id: uuid.UUID,
        candidate_id: uuid.UUID,
        background_tasks,
        override_version: int | None = None,
    ) -> None:
        """Trigger re-analysis for a single candidate."""
        job = await job_repository.get(db, job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job not found."
            )

        bg_processor = BackgroundProcessor(ResumeProcessor())
        bg_processor.schedule_candidate_reanalyze(
            job_id=job_id, candidate_id=candidate_id, override_version=override_version
        )

    async def delete_resume(
        self,
        *,
        db: AsyncSession,
        resume_id: uuid.UUID,
        job_id: uuid.UUID,
    ) -> bool:
        """Delete a resume and its associated data."""
        return await resume_upload_repository.delete_resume(
            db, resume_id=resume_id, job_id=job_id
        )

    # Legacy update_resume_status method was removed as it handled old pass_fail logic


resume_upload_service = ResumeUploadService()
