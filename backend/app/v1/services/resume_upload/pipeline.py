"""
Pipeline for processing a single resume upload.
"""
import asyncio
import hashlib
import time
import uuid
from typing import Awaitable, Callable, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from sqlalchemy.orm import selectinload
from app.v1.db.models.job_versions import JobVersion
from app.v1.db.models.resumes import Resume
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.cross_job_matches import CrossJobMatch
from app.v1.db.models.files import File



from app.v1.core.logging import get_logger
from app.v1.core.resume_executor import run_in_resume_executor
from app.v1.db.session import async_session_maker
from app.v1.repository.job_repository import job_repository
from app.v1.repository.resume_upload_repository import resume_upload_repository
from app.v1.schemas.upload import ResumeMatchAnalysis
from app.v1.utils.resume_upload import extract_skill_names, split_name
from .converters import build_processing_info, merge_processing_info
from .logging import log_event, log_stage
from .processor import ResumeProcessor
from app.v1.core.observability import get_tracer
from opentelemetry.trace import StatusCode

logger = get_logger(__name__)
tracer = get_tracer("hiring-platform.pipeline")

async def run_resume_processing_pipeline(
    *,
    job_id: uuid.UUID,
    resume_id: uuid.UUID,
    file_path: str,
    processor: ResumeProcessor,
    mark_failed_cb: Callable[[AsyncSession, uuid.UUID, dict | None, str], Awaitable[None]],
    reanalyze: bool = False,
    existing_resume_id: uuid.UUID | None = None,
    override_version: int | None = None,
) -> None:
    """Full background processing workflow for an uploaded or re-analyzed resume.

    Extracts text (if not re-analyzing), normalizes data, generates embeddings, 
    performs AI match analysis, and persists results to the database.

    Args:
        job_id: The job ID.
        resume_id: The resume ID.
        file_path: Path to the stored resume file.
        reanalyze: If True, skips extraction and uses stored data.
    """
    with tracer.start_as_current_span("resume-processing-pipeline") as span:
        span.set_attribute("job_id", str(job_id))
        span.set_attribute("resume_id", str(resume_id))
        span.set_attribute("reanalyze", reanalyze)
        
        try:
            result = await _run_resume_pipeline(
                job_id=job_id,
                resume_id=resume_id,
                file_path=file_path,
                processor=processor,
                mark_failed_cb=mark_failed_cb,
                reanalyze=reanalyze,
                existing_resume_id=existing_resume_id,
                override_version=override_version,
                span=span
            )
            span.set_status(StatusCode.OK)
            return result
        except Exception as e:
            span.set_status(StatusCode.ERROR, str(e))
            span.record_exception(e)
            raise e

async def _run_resume_pipeline(
    *,
    job_id: uuid.UUID,
    resume_id: uuid.UUID,
    file_path: str,
    processor: ResumeProcessor,
    mark_failed_cb: Callable[[AsyncSession, uuid.UUID, dict | None, str], Awaitable[None]],
    reanalyze: bool = False,
    existing_resume_id: uuid.UUID | None = None,
    override_version: int | None = None,
    span=None
) -> None:
    """Internal pipeline logic."""
    total_started_at = time.perf_counter()
    log_event(
        event="background_started" if not reanalyze else "reanalyze_started",
        job_id=job_id,
        resume_id=resume_id,
        file_path=file_path,
    )

    async with async_session_maker() as db:
        stage_started_at = time.perf_counter()
        
        # Retry logic for race conditions where Celery starts before commit is fully visible
        resume_record = None
        for attempt in range(3):
            resume_record = await db.scalar(
                select(Resume)
                .options(
                    selectinload(Resume.file),
                    selectinload(Resume.version_results),
                    selectinload(Resume.candidate),
                )
                .where(Resume.id == resume_id)
            )
            if resume_record:
                break
            if attempt < 2:
                logger.warning("Resume %s not found in DB, retrying in 1s... (attempt %d)", resume_id, attempt + 1)
                await asyncio.sleep(1)

        log_stage(
            stage="load_resume_for_background",
            started_at=stage_started_at,
            job_id=job_id,
            resume_id=resume_id,
        )
        if resume_record is None:
            logger.error(
                "resume_processing missing resume_id=%s job_id=%s after retries",
                resume_id,
                job_id,
            )
            return

        stage_started_at = time.perf_counter()
        resume_record.parse_summary = merge_processing_info(
            getattr(resume_record, "parse_summary", None),
            status_value="processing",
        )
        await resume_upload_repository.commit(db)
        log_stage(
            stage="mark_processing",
            started_at=stage_started_at,
            job_id=job_id,
            resume_id=resume_id,
        )

        candidate = resume_record.candidate
        stage_started_at = time.perf_counter()
        job = await job_repository.get(db, job_id)
        log_stage(
            stage="load_job",
            started_at=stage_started_at,
            job_id=job_id,
            resume_id=resume_id,
        )
        if job is None:
            await mark_failed_cb(
                db=db,
                resume_id=resume_id,
                current_parse_summary=getattr(
                    resume_record, "parse_summary", None
                ),
                error_message="Job not found during background processing.",
            )
            return

        target_job = job
        # Use override_version if provided, otherwise fallback to pinned processing_version
        target_version_num = override_version or getattr(job, "processing_version", None)
        
        if target_version_num and target_version_num != job.version:
            target_version_obj = (await db.execute(select(JobVersion).where(JobVersion.job_id == job.id, JobVersion.version_number == target_version_num))).scalar_one_or_none()
            if target_version_obj:
                class JobVersionProxy:
                    def __init__(self, main_job, job_version):
                        self.id = main_job.id
                        self.version = job_version.version_number
                        self.title = job_version.title
                        self.jd_text = job_version.jd_text
                        self.jd_json = job_version.jd_json
                        self.custom_extraction_fields = job_version.custom_extraction_fields
                        self.passing_threshold = job_version.passing_threshold
                        self.jd_embedding = job_version.jd_embedding 
                target_job = JobVersionProxy(job, target_version_obj)

        try:
            raw_text = ""
            parsed_summary = {}
            text_hash = resume_record.text_hash

            # ---- Optimization: Reuse existing resume data if available ----
            if existing_resume_id and not reanalyze:
                logger.info("[PIPELINE] DUPLICATE DETECTED: Re-using data from existing resume %s for resume %s", existing_resume_id, resume_id)
                raw_text = await resume_upload_repository.get_resume_full_text(db, existing_resume_id)
                existing_resume_obj = await db.get(Resume, existing_resume_id)
                if existing_resume_obj:
                    parsed_summary = dict(existing_resume_obj.parse_summary or {})
                    # Clean up processing/analysis as we'll re-analyze for THIS job
                    parsed_summary.pop("analysis", None)
                    parsed_summary.pop("processing", None)
                    text_hash = existing_resume_obj.text_hash
                    
                    # Mark as skipped extraction
                    reanalyze = True 
                    logger.info("Successfully copied data from global duplicate. Skipping LLM extraction.")
            # --------------------------------------------------------------

            if not reanalyze:
                logger.info("[PIPELINE] Starting LLM extraction for resume_id=%s", resume_id)
                stage_started_at = time.perf_counter()
                raw_text, normalized = await run_in_resume_executor(
                    processor.process_resume,
                    file_path,
                )
                logger.info("[PIPELINE] LLM extraction complete for resume_id=%s in %.2fs", resume_id, time.perf_counter() - stage_started_at)
                log_stage(
                    stage="extract_and_normalize",
                    started_at=stage_started_at,
                    job_id=job_id,
                    resume_id=resume_id,
                )

                # ---- Issue #25: content-level deduplication ------
                text_hash = hashlib.sha256(raw_text.encode()).hexdigest()
                stage_started_at = time.perf_counter()
                twin_resume = await resume_upload_repository.get_resume_by_text_hash_for_job(
                    db,
                    job_id=job_id,
                    text_hash=text_hash,
                    exclude_resume_id=resume_record.id,
                )
                if twin_resume is not None:
                    # Same text content found (e.g. pdf vs docx of same file).
                    # Copy the existing analysis instead of re-running LLM.
                    log_event(
                        event="content_dedup_hit",
                        job_id=job_id,
                        resume_id=resume_id,
                        twin_resume_id=twin_resume.id,
                    )
                    resume_record.parse_summary = twin_resume.parse_summary
                    resume_record.parsed = True
                    resume_record.resume_score = twin_resume.resume_score
                    resume_record.pass_fail = twin_resume.pass_fail
                    resume_record.text_hash = text_hash
                    await resume_upload_repository.commit(db)
                    log_stage(
                        stage="total_dedup",
                        started_at=total_started_at,
                        job_id=job_id,
                        resume_id=resume_id,
                    )
                    return
                # --------------------------------------------------

                from app.v1.utils.text import extract_heuristic_info, standardize_to_resume_spaced
                
                # Helper to check if a value is effectively missing
                def is_missing(val):
                    if not val: return True
                    if isinstance(val, str) and val.strip().lower() in ("not mentioned", "null", "none", "unknown", "n/a"): return True
                    return False

                h_info = extract_heuristic_info(raw_text)
                
                # Email fallback
                parsed_email = (
                    str(normalized["email"][0]["text"]).strip()
                    if normalized.get("email") and not is_missing(normalized["email"][0]["text"])
                    else h_info.get("email")
                )

                # Name fallback logic
                # 1. Try LLM normalized name
                parsed_name = (
                    str(normalized["name"][0]["text"]).strip()
                    if normalized.get("name") and not is_missing(normalized["name"][0]["text"])
                    else None
                )
                
                # 2. Try Heuristic name if LLM failed
                if not parsed_name and h_info.get("name") and not is_missing(h_info["name"]):
                    parsed_name = h_info["name"]
                    
                # 3. Last resort: Extract name from email if still None
                if not parsed_name or is_missing(parsed_name):
                    if parsed_email:
                        email_user = parsed_email.split("@")[0]
                        parsed_name = email_user.replace(".", " ").replace("_", " ").title()
                        logger.info(f"Derived name from email: {parsed_name}")
                    else:
                        parsed_name = "Candidate"

                # Phone fallback
                raw_phone = (
                    str(normalized["phone"][0]["text"]).strip()
                    if normalized.get("phone") and not is_missing(normalized["phone"][0]["text"])
                    else h_info.get("phone")
                )
                parsed_phone = standardize_to_resume_spaced(raw_phone) if raw_phone else None

                # Location fallback
                parsed_location = None
                for loc_item in normalized.get("location", []):
                    if isinstance(loc_item, dict):
                        loc_text = str(loc_item.get("text") or loc_item.get("location") or "").strip()
                    else:
                        loc_text = str(loc_item).strip()
                    if not is_missing(loc_text):
                        parsed_location = loc_text
                        break

                # Social Links fallback
                if not normalized.get("links") or is_missing(normalized["links"][0]["text"]):
                    if h_info.get("links"):
                        normalized["links"] = [{"text": link, "attributes": {}} for link in h_info["links"]]
                
                first_name, last_name = split_name(parsed_name)

                parsed_summary = {
                    "name": parsed_name,
                    "email": parsed_email,
                    "phone": parsed_phone,
                    "location": [loc for loc in normalized.get("location", []) if not is_missing(loc.get("text") if isinstance(loc, dict) else loc)],
                    "skills": normalized.get("skills", []),
                    "experience": normalized.get("experience", []),
                    "education": normalized.get("education", []),
                    "certifications": normalized.get("certifications", []),
                    "links": normalized.get("links", []),
                    "extraordinary_highlights": normalized.get("extraordinary_highlights", []),
                    "professional_summary": normalized.get("professional_summary", []),
                    "experience_summary": normalized.get("experience_summary", []),
                }
                extracted_skill_names_list = extract_skill_names(normalized)
            else:
                # RE-ANALYZE PATH: Load stored text and summary
                logger.info("Using stored data for re-analysis/duplicate of resume %s", resume_id)
                if not raw_text:
                    raw_text = await resume_upload_repository.get_resume_full_text(db, resume_id)
                if not raw_text:
                    raise ValueError("Stored raw text not found for re-analysis.")
                
                # Use existing summary if not already populated from duplicate
                if not parsed_summary:
                    parsed_summary = dict(resume_record.parse_summary or {})
                parsed_summary.pop("analysis", None)
                parsed_summary.pop("processing", None)
                
                parsed_email = parsed_summary.get("email")
                parsed_name = parsed_summary.get("name", "Candidate")
                raw_phone = parsed_summary.get("phone")
                parsed_phone = standardize_to_resume_spaced(raw_phone) if raw_phone else None
                first_name, last_name = split_name(parsed_name)
                
                extracted_skill_names_list = parsed_summary.get("skills", [])
                # If skills are stored as objects, extract names
                if extracted_skill_names_list and isinstance(extracted_skill_names_list[0], dict):
                    extracted_skill_names_list = [s.get("text", "") for s in extracted_skill_names_list]

            # ---- Silent Parsing & Candidate Creation / Merge Logic (RUNS FOR BOTH PATHS) ----
            existing_candidate = None
            if parsed_email:
                # Check for existing candidate with same email
                existing_cand_stmt = select(Candidate).where(func.lower(Candidate.email) == parsed_email.lower()).limit(1)
                existing_candidate = await db.scalar(existing_cand_stmt)
                
            if existing_candidate:
                logger.info(f"[PIPELINE] EMAIL DEDUPLICATION: Merging upload for {parsed_email} into existing candidate {existing_candidate.id}")
                
                resume_record.candidate_id = existing_candidate.id
                if resume_record.file:
                    resume_record.file.candidate_id = existing_candidate.id
                
                if existing_candidate.applied_job_id == job_id:
                    pass
                else:
                    xm_exists = await db.scalar(
                        select(CrossJobMatch.id).where(
                            CrossJobMatch.candidate_id == existing_candidate.id,
                            CrossJobMatch.matched_job_id == job_id
                        )
                    )
                    if not xm_exists:
                        new_xm = CrossJobMatch(
                            candidate_id=existing_candidate.id,
                            matched_job_id=job_id,
                            resume_id=resume_id,
                            match_score=0.0,
                            match_analysis={}
                        )
                        db.add(new_xm)
                        
                # Clean up the placeholder candidate
                if candidate and candidate.id != existing_candidate.id:
                    placeholder_id = candidate.id
                    from app.v1.db.models.candidate_stages import CandidateStage
                    await db.execute(delete(CandidateStage).where(CandidateStage.candidate_id == placeholder_id))
                    await db.execute(delete(Candidate).where(Candidate.id == placeholder_id))
                        
                candidate = existing_candidate
                resume_record.candidate = existing_candidate
            else:
                if not candidate:
                    logger.info(f"[PIPELINE] Creating new candidate {parsed_email}")
                    new_candidate = Candidate(
                        applied_job_id=job_id,
                        first_name=first_name,
                        last_name=last_name,
                        email=parsed_email,
                        phone=parsed_phone,
                        location_id=None,
                        info={},
                        applied_version_number=job.version,
                    )
                    db.add(new_candidate)
                    await db.flush()
                    
                    candidate = new_candidate
                    resume_record.candidate_id = candidate.id
                    resume_record.candidate = candidate
                    if resume_record.file:
                        resume_record.file.candidate_id = candidate.id
            # ---------------------------------------------------------------------------------

            job_skills = await resume_upload_repository.get_job_skills(
                db,
                job_id=job_id,
            )

            logger.info("[PIPELINE] Starting AI Analysis (insights) for resume_id=%s against job_id=%s", resume_id, job_id)
            stage_started_at = time.perf_counter()
            insights = await processor.generate_resume_insights(
                raw_text=raw_text,
                parsed_summary=parsed_summary,
                job=target_job,
                job_skills=job_skills,
                candidate_skills=extracted_skill_names_list,
            )
            logger.info("[PIPELINE] AI Analysis complete for resume_id=%s in %.2fs", resume_id, time.perf_counter() - stage_started_at)
            log_stage(
                stage="analysis_and_embeddings",
                started_at=stage_started_at,
                job_id=job_id,
                resume_id=resume_id,
            )

            # ---- Safety Check: Ensure resume hasn't been deleted during long processing ----
            if not await resume_upload_repository.resume_exists(db, resume_id):
                logger.info(
                    "Stopping processing: resume_id=%s was deleted during analysis phase.",
                    resume_id
                )
                return
            # --------------------------------------------------------------------------------

            stage_started_at = time.perf_counter()
            needs_job_embedding_update = False
            if insights["job_embedding"]:
                current_dim = len(insights["job_embedding"])
                if target_job.jd_embedding is None:
                    needs_job_embedding_update = True
                elif len(target_job.jd_embedding) != current_dim:
                    logger.info(
                        "Updating job %s embedding due to dimension mismatch (old=%d, new=%d)",
                        job_id, len(job.jd_embedding), current_dim
                    )
                    needs_job_embedding_update = True

            if needs_job_embedding_update and target_job.version == job.version:
                await resume_upload_repository.update_job_embedding(
                    db,
                    job=job,
                    embedding=insights["job_embedding"],
                )
            log_stage(
                stage="persist_job_embedding",
                started_at=stage_started_at,
                job_id=job_id,
                resume_id=resume_id,
            )

            stage_started_at = time.perf_counter()
            await resume_upload_repository.update_skill_embeddings(
                db,
                embeddings_by_skill_id=insights["skill_embeddings"],
            )
            log_stage(
                stage="persist_job_skill_embeddings",
                started_at=stage_started_at,
                job_id=job_id,
                resume_id=resume_id,
                count=len(insights["skill_embeddings"]),
            )

            stage_started_at = time.perf_counter()
            if not reanalyze:
                await resume_upload_repository.update_candidate_profile(
                    db,
                    candidate=candidate,
                    first_name=first_name,
                    last_name=last_name,
                    email=parsed_email,
                    phone=parsed_phone,
                    location=parsed_location,
                    info=parsed_summary,
                    info_embedding=insights["candidate_embedding"],
                )
            else:
                # For re-analysis, we still update applied version and info embedding
                candidate.info_embedding = insights["candidate_embedding"]
            
            resume_record.resume_embedding = insights["candidate_embedding"]
            candidate.applied_version_number = target_job.version
            log_stage(
                stage="persist_candidate_profile",
                started_at=stage_started_at,
                job_id=job_id,
                resume_id=resume_id,
            )

            custom_extractions = {}
            if getattr(target_job, "custom_extraction_fields", None):
                logger.info("[PIPELINE] Starting Custom Field Extraction for resume_id=%s", resume_id)
                from app.v1.services.resume_upload.custom_extractor import custom_extractor_service
                custom_extractions = await custom_extractor_service.extract_background_custom_fields(
                    raw_text=raw_text,
                    fields_list=target_job.custom_extraction_fields,
                )
                logger.info("[PIPELINE] Custom Field Extraction complete for resume_id=%s", resume_id)

            analysis = ResumeMatchAnalysis.model_validate(
                insights["analysis"]
            )
            if custom_extractions:
                analysis.custom_extractions = custom_extractions

            parse_summary_with_analysis = {
                **parsed_summary,
                "analysis": analysis.model_dump(),
                "processing": build_processing_info(
                    status_value="completed"
                ),
            }
            resume_record.parsed = True
            resume_record.parse_summary = parse_summary_with_analysis
            resume_record.resume_score = analysis.match_percentage
            resume_record.pass_fail = "passed" if float(resume_record.resume_score or 0) >= (target_job.passing_threshold or 70.0) else "failed"
            resume_record.text_hash = text_hash

            # Phoenix span mein detailed info add karo
            if span:
                span.set_attribute("candidate_name", parsed_name or "unknown")
                span.set_attribute("job_title", getattr(target_job, "title", "unknown"))
                span.set_attribute("resume_score", float(resume_record.resume_score or 0))
                span.set_attribute("pass_fail", resume_record.pass_fail)
                span.set_attribute("skills_count", len(parsed_summary.get("skills", [])))
                if custom_extractions:
                    span.set_attribute("custom_fields_extracted", len(custom_extractions))

            # --- Save versioned result ---
            from app.v1.db.models.resume_version_results import ResumeVersionResult
            versioned = ResumeVersionResult(
                resume_id=resume_record.id,
                job_id=target_job.id,
                job_version_number=target_job.version,
                resume_score=resume_record.resume_score,
                pass_fail=resume_record.pass_fail,
                analysis_data=analysis.model_dump(),
            )
            db.add(versioned)
            # -----------------------------

            if not reanalyze:
                stage_started_at = time.perf_counter()
                for chunk_data in insights["chunk_embeddings"]:
                    await resume_upload_repository.create_resume_chunk(
                        db,
                        resume_id=resume_id,
                        parsed_json=parse_summary_with_analysis,
                        raw_text=chunk_data["text"],
                        chunk_embedding=chunk_data["embedding"],
                    )
                log_stage(
                    stage="create_resume_chunks",
                    started_at=stage_started_at,
                    job_id=job_id,
                    resume_id=resume_id,
                    count=len(insights["chunk_embeddings"]),
                )
            else:
                # Update existing chunks with new analysis (best effort)
                from app.v1.db.models.resume_chunks import ResumeChunk
                from sqlalchemy import update
                await db.execute(
                    update(ResumeChunk)
                    .where(ResumeChunk.resume_id == resume_id)
                    .values(parsed_json=parse_summary_with_analysis)
                )

            if not reanalyze:
                stage_started_at = time.perf_counter()
                candidate_skill_records = (
                    await resume_upload_repository.sync_candidate_skills(
                        db,
                        candidate_id=candidate.id,
                        skill_names=extracted_skill_names_list,
                    )
                )
                log_stage(
                    stage="sync_candidate_skills",
                    started_at=stage_started_at,
                    job_id=job_id,
                    resume_id=resume_id,
                    count=len(candidate_skill_records),
                )

                stage_started_at = time.perf_counter()
                candidate_skill_embeddings = await run_in_resume_executor(
                    processor.generate_skill_embeddings,
                    candidate_skill_records,
                )
                log_stage(
                    stage="candidate_skill_embeddings",
                    started_at=stage_started_at,
                    job_id=job_id,
                    resume_id=resume_id,
                )
                stage_started_at = time.perf_counter()
                await resume_upload_repository.update_skill_embeddings(
                    db,
                    embeddings_by_skill_id=candidate_skill_embeddings,
                )
                log_stage(
                    stage="persist_candidate_skill_embeddings",
                    started_at=stage_started_at,
                    job_id=job_id,
                    resume_id=resume_id,
                    count=len(candidate_skill_embeddings),
                )

            stage_started_at = time.perf_counter()
            await resume_upload_repository.commit(db)
            log_stage(
                stage="commit_completed_resume",
                started_at=stage_started_at,
                job_id=job_id,
                resume_id=resume_id,
            )

            # NEW: Automatically initiate pipeline and activate Stage 0 (Resume Screening)
            from app.v1.db.models.candidate_stages import CandidateStage
            from app.v1.db.models.job_stage_configs import JobStageConfig
            from app.v1.services.candidate_stage_service import candidate_stage_service
            
            # 1. Ensure pipeline exists
            existing_stages_stmt = (
                select(CandidateStage)
                .select_from(CandidateStage)
                .join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
                .where(JobStageConfig.job_id == job_id, CandidateStage.candidate_id == candidate.id)
            )
            existing_stages = (await db.execute(existing_stages_stmt)).scalars().all()
            
            if not existing_stages:
                await candidate_stage_service.initiate_candidate_pipeline(db, candidate.id, job_id)
                await db.commit()
                logger.info(f"Auto-initiated pipeline for candidate {candidate.id} during background processing.")

            # 2. Activate Stage 0 and populate with AI results
            cs_stmt = (
                select(CandidateStage)
                .join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
                .where(
                    CandidateStage.candidate_id == candidate.id,
                    JobStageConfig.job_id == job_id,
                    JobStageConfig.stage_order == 0
                )
            )
            cs_res = await db.execute(cs_stmt)
            cs_zero = cs_res.scalar_one_or_none()
            
            if cs_zero:
                cs_zero.status = "active"
                cs_zero.evaluation_data = analysis.model_dump()
                if not cs_zero.started_at:
                    from datetime import datetime
                    cs_zero.started_at = datetime.utcnow()
                await db.commit()
                logger.info(f"Auto-activated Stage 0 for candidate {candidate.id} with AI analysis results.")
            
            # Force-clear cache using synchronous redis to ensure reliability in Celery
            try:
                import redis
                from app.v1.core.config import settings
                r_client = redis.from_url(settings.REDIS_URL)
                jid_str = str(job_id)
                # Clear all variations of candidate lists for this job
                keys_to_del = r_client.keys(f"candidates:for_job:{jid_str}*")
                if keys_to_del:
                    r_client.delete(*keys_to_del)
                # Clear stats and analytics
                r_client.delete(f"job_stats:{jid_str}")
                logger.info(f"Force-cleared {len(keys_to_del)} cache keys for job {jid_str}")
            except Exception as cache_err:
                logger.error(f"Force cache clear failed: {cache_err}")

            log_stage(
                stage="total",
                started_at=total_started_at,
                job_id=job_id,
                resume_id=resume_id,
            )

        except Exception as exc:
            parse_summary_snapshot = getattr(
                resume_record, "parse_summary", None
            )
            await resume_upload_repository.rollback(db)
            logger.exception(
                "resume_processing failed job_id=%s resume_id=%s",
                job_id,
                resume_id,
            )
            await mark_failed_cb(
                db=db,
                resume_id=resume_id,
                current_parse_summary=parse_summary_snapshot,
                error_message=str(exc),
            )
            
            # Force-clear cache on failure as well
            try:
                import redis
                from app.v1.core.config import settings
                r_client = redis.from_url(settings.REDIS_URL)
                jid_str = str(job_id)
                keys_to_del = r_client.keys(f"candidates:for_job:{jid_str}*")
                if keys_to_del:
                    r_client.delete(*keys_to_del)
                r_client.delete(f"job_stats:{jid_str}")
            except:
                pass

            log_stage(
                stage="total_failed",
                started_at=total_started_at,
                job_id=job_id,
                resume_id=resume_id,
            )
