import uuid
import logging

from sqlalchemy import select

from app.v1.db.session import async_session_maker
from app.v1.repository.cross_job_match_repository import cross_job_match_repository
from app.v1.core.embeddings import embedding_service
from app.v1.utils.text import build_job_text
from app.v1.db.models.resume_chunks import ResumeChunk
from app.v1.db.models.job_chunks import JobChunk
from app.v1.db.models.cross_job_matches import CrossJobMatch
from app.v1.db.models.hr_decisions import HrDecision
from app.v1.services.candidate_stage_service import candidate_stage_service
from sqlalchemy import or_, func

_log = logging.getLogger(__name__)

_MIN_SCORE   = 0.0   # store all matches

class CrossJobMatchService:
    """Service for cross-job matching using bi-encoder + chunk reranking.
    
    Architecture (v2):
    - NO duplicate Candidate or Resume records are created.
    - Job-specific AI analysis is stored directly in cross_job_matches.match_analysis.
    - get_candidates_for_job merges cross-matched candidates on the fly.
    """

    async def run_cross_match(self, *, resume_id: uuid.UUID, original_job_id: uuid.UUID) -> None:
        """Run cross-job matching and store AI analysis per matched job."""
        from app.v1.db.models.candidates import Candidate
        from app.v1.db.models.resumes import Resume
        from app.v1.services.resume_upload.background import BackgroundProcessor
        from app.v1.services.resume_upload.processor import ResumeProcessor

        async with async_session_maker() as db:
            # 1. Load original resume + candidate
            resume = await db.get(Resume, resume_id)
            if not resume:
                _log.warning("run_cross_match: resume %s not found", resume_id)
                return

            orig_candidate = await db.get(Candidate, resume.candidate_id)
            if not orig_candidate:
                _log.warning("run_cross_match: candidate not found for resume %s", resume_id)
                return

            # Skip cross-matching if the candidate is already passed/approved for ANY job
            check_approve = await db.execute(
                select(HrDecision.id).where(
                    HrDecision.candidate_id == orig_candidate.id,
                    func.lower(HrDecision.decision) == "pass"
                ).limit(1)
            )
            if check_approve.scalar():
                _log.info("run_cross_match: candidate %s already passed elsewhere — skipping cross-match", orig_candidate.id)
                return

            # 2. Get embedding — resume level first, fallback to chunks
            chunk_stmt = select(ResumeChunk).where(ResumeChunk.resume_id == resume_id)
            orig_chunks = (await db.execute(chunk_stmt)).scalars().all()
            resume_embeddings = [c.chunk_embedding for c in orig_chunks if c.chunk_embedding is not None]
            raw_text = orig_chunks[0].raw_text if orig_chunks else ""

            base_embedding = (
                resume.resume_embedding
                if resume.resume_embedding is not None
                else (resume_embeddings[0] if resume_embeddings else None)
            )
            if base_embedding is None:
                _log.warning("run_cross_match: no embedding for resume %s — skipping", resume_id)
                return

            # 3. Find all jobs this resume/candidate is ALREADY linked to (Applied OR Cross-matched)
            #    This prevents discovery from duplicating them into jobs they are already in.
            already_linked_job_ids: set[uuid.UUID] = {original_job_id}
            
            # Check other native apps for this email/hash
            if resume.text_hash:
                from app.v1.db.models.candidates import Candidate as CandidateModel
                existing_apps_stmt = (
                    select(CandidateModel.applied_job_id)
                    .join(Resume, Resume.candidate_id == CandidateModel.id)
                    .where(Resume.text_hash == resume.text_hash)
                )
                existing_apps = (await db.execute(existing_apps_stmt)).scalars().all()
                for ajid in existing_apps:
                    if ajid: already_linked_job_ids.add(ajid)

            # IMPORTANT: Also check existing cross-matches for this specific candidate ID
            existing_xm_stmt = select(CrossJobMatch.matched_job_id).where(
                CrossJobMatch.candidate_id == orig_candidate.id
            )
            existing_xms = (await db.execute(existing_xm_stmt)).scalars().all()
            for xjid in existing_xms:
                if xjid: already_linked_job_ids.add(xjid)

            _log.info(
                "run_cross_match: candidate %s already in %d job(s) — will skip discovery for these.",
                orig_candidate.id, len(already_linked_job_ids)
            )

            # 4. Fetch all other active jobs, excluding already-linked jobs
            other_jobs = await cross_job_match_repository.get_all_active_jobs_with_embeddings(
                db, exclude_job_id=original_job_id
            )
            # Filter out any jobs the candidate is already part of
            other_jobs = [j for j in other_jobs if j.id not in already_linked_job_ids]
            
            if not other_jobs:
                _log.info("run_cross_match: no other active jobs found")
                return
            
            scored = []
            for job in other_jobs:
                job_emb = job.jd_embedding
                if job_emb is None:
                    try:
                        _log.info("Job %s missing embedding. Generating on demand...", job.title)
                        job_emb = embedding_service.encode_jd(build_job_text(job))
                        job.jd_embedding = job_emb
                        await db.flush()
                    except Exception as e:
                        _log.warning("Failed to generate embedding for job %s (%s): %s", job.title, job.id, e)
                        continue
                bi_score = embedding_service.get_semantic_score_from_embeddings(base_embedding, job_emb)
                _log.info("Rough bi-encoder score for %s: %f", job.title, bi_score)
                scored.append({"job": job, "score": bi_score})

            # 4. Deep rerank using chunk-level similarity
            # No limit: we process all jobs in 'scored'
            _log.info("Proceeding to deep-rerank and analysis for %d jobs.", len(scored))
            
            for item in scored:
                job = item["job"]
                try:
                    job_chunks = (await db.execute(
                        select(JobChunk.chunk_embedding).where(JobChunk.job_id == job.id)
                    )).scalars().all()
                    job_chunks = [j for j in job_chunks if j is not None]

                    if job_chunks and resume_embeddings:
                        max_sim = max(
                            embedding_service.get_semantic_score_from_embeddings(r, j)
                            for r in resume_embeddings
                            for j in job_chunks
                        )
                        _log.info("Detailed chunk-rerank score for %s: %f (prev: %f)", job.title, max_sim, item["score"])
                        item["score"] = max_sim
                except Exception as e:
                    _log.warning("Failed chunk-rerank for job %s: %s", job.title, e)
                    pass  # keep bi_score

            # 5. Persist match records for all scored jobs
            match_data = [
                {
                    "candidate_id": orig_candidate.id,
                    "matched_job_id": item["job"].id,
                    "match_score": item["score"],
                }
                for item in scored
            ]
            
            await cross_job_match_repository.upsert_matches(
                db,
                resume_id=resume_id,
                original_job_id=original_job_id,
                matches=match_data,
            )
            await db.commit()
            _log.info("Stored %d cross-job matches for resume_id=%s", len(match_data), resume_id)

            # 5.5 Initiate hiring pipelines for all matched jobs
            for item in scored:
                try:
                    await candidate_stage_service.initiate_candidate_pipeline(
                        db, orig_candidate.id, item["job"].id
                    )
                except Exception as e:
                    _log.warning("Failed to initiate pipeline for job %s: %s", item["job"].id, e)
            await db.commit()

            # 6. Generate job-specific AI analysis for each match (reuse raw_text + chunks)
            bg_processor = BackgroundProcessor(ResumeProcessor())
            from sqlalchemy.orm.attributes import flag_modified
            from sqlalchemy import select as sa_select

            for item in scored:
                job = item["job"]
                try:
                    _log.info("Generating cross-match analysis for job: %s", job.title)
                    
                    # Strip previous analysis/processing info from the summary
                    # to ensure the AI generates fresh insights for the new job context.
                    clean_summary = dict(resume.parse_summary or {})
                    clean_summary.pop("analysis", None)
                    clean_summary.pop("processing", None)

                    insights = await bg_processor.processor.generate_resume_insights(
                        raw_text=raw_text,
                        parsed_summary=clean_summary,
                        job=job,
                        job_skills=await _get_job_skills(db, job.id),
                        candidate_skills=_extract_skills(resume.parse_summary),
                    )
                    analysis_data = insights.get("analysis", {})

                    # Store analysis back into the match record
                    async with async_session_maker() as db2:
                        match_row = (await db2.execute(
                            sa_select(CrossJobMatch).where(
                                CrossJobMatch.resume_id == resume_id,
                                CrossJobMatch.matched_job_id == job.id,
                            )
                        )).scalars().first()
                        if match_row:
                            match_row.match_analysis = analysis_data
                            flag_modified(match_row, "match_analysis")
                            
                            # Also save as a ResumeVersionResult for consistent history tracking
                            from app.v1.db.models.resume_version_results import ResumeVersionResult
                            versioned = ResumeVersionResult(
                                resume_id=resume_id,
                                job_id=job.id,
                                job_version_number=job.version,
                                resume_score=match_row.match_score,
                                pass_fail="passed" if float(match_row.match_score) >= (job.passing_threshold or 70.0) else "failed",
                                analysis_data=analysis_data,
                            )
                            db2.add(versioned)
                            
                            await db2.commit()
                except Exception as e:
                    _log.warning("Failed analysis for job %s: %s", job.id, e)

            _log.info("Cross-job matching complete for resume_id=%s", resume_id)

    async def run_new_job_matching(self, job_id: uuid.UUID, months_limit: int = 3) -> None:
        """Match existing resumes against a newly created job.
        
        By default, matches only resumes from the last N months to keep the 
        initial pool fresh and manageable.
        """
        from datetime import datetime, timedelta
        from app.v1.db.models.jobs import Job
        from app.v1.db.models.resumes import Resume
        from app.v1.db.models.candidates import Candidate
        from app.v1.db.models.resume_chunks import ResumeChunk
        from app.v1.db.models.cross_job_matches import CrossJobMatch
        from app.v1.services.resume_upload.background import BackgroundProcessor
        from app.v1.services.resume_upload.processor import ResumeProcessor
        from sqlalchemy.orm import selectinload
        from sqlalchemy.orm.attributes import flag_modified
        from app.v1.db.models.resume_version_results import ResumeVersionResult

        async with async_session_maker() as db:
            # 1. Load the new job
            job = await db.get(Job, job_id)
            if not job:
                _log.warning("run_new_job_matching: job %s not found", job_id)
                return

            # Ensure job has embedding
            if job.jd_embedding is None:
                job_text = build_job_text(job)
                job.jd_embedding = embedding_service.encode_jd(job_text)
                await db.commit()

            job_emb = job.jd_embedding

            # 2. Fetch resumes from the last N months that have embeddings and are parsed
            # AND the candidate is NOT approved for any job
            since_date = datetime.now() - timedelta(days=30 * months_limit)
            
            # Subquery to find candidates who are already passed
            approved_candidates_subq = select(HrDecision.candidate_id).where(
                func.lower(HrDecision.decision) == "pass"
            )

            resume_stmt = (
                select(Resume)
                .options(selectinload(Resume.candidate))
                .where(
                    Resume.resume_embedding != None, 
                    Resume.parsed == True,
                    Resume.uploaded_at >= since_date,
                    ~Resume.candidate_id.in_(approved_candidates_subq)
                )
            )
            resumes = (await db.execute(resume_stmt)).scalars().all()
            
            if not resumes:
                _log.info("run_new_job_matching: no resumes with embeddings found")
                return

            _log.info("Matching %d resumes against new job: %s", len(resumes), job.title)

            # 3. Calculate scores and prepare match records
            matches_to_upsert = []
            all_matched_resumes = [] 

            for resume in resumes:
                # Skip if already applied to this job directly (unlikely for new job but safe)
                if resume.candidate and resume.candidate.applied_job_id == job_id:
                    continue
                
                score = embedding_service.get_semantic_score_from_embeddings(resume.resume_embedding, job_emb)
                
                matches_to_upsert.append({
                    "resume_id": resume.id,
                    "candidate_id": resume.candidate_id,
                    "matched_job_id": job_id,
                    "match_score": score
                })
                
                # All candidates are now considered for AI analysis and pipeline as per user request
                all_matched_resumes.append(resume)

            # 4. Store match records
            for m in matches_to_upsert:
                existing_match_stmt = select(CrossJobMatch).where(
                    CrossJobMatch.resume_id == m["resume_id"],
                    CrossJobMatch.matched_job_id == job_id
                )
                existing = (await db.execute(existing_match_stmt)).scalars().first()
                if existing:
                    existing.match_score = m["match_score"]
                else:
                    db.add(CrossJobMatch(
                        resume_id=m["resume_id"],
                        candidate_id=m["candidate_id"],
                        original_job_id=resume.candidate.applied_job_id if resume.candidate else None,
                        matched_job_id=job_id,
                        match_score=m["match_score"]
                    ))
            
            await db.commit()

            # 5. Initiate hiring pipelines for all matched candidates
            for resume in all_matched_resumes:
                try:
                    await candidate_stage_service.initiate_candidate_pipeline(
                        db, resume.candidate_id, job_id
                    )
                except Exception as e:
                    _log.warning("Failed to initiate pipeline for candidate %s: %s", resume.candidate_id, e)
            await db.commit()

            # 6. Run detailed AI Analysis for ALL matched candidates
            _log.info("Running AI analysis for all %d matched candidates", len(all_matched_resumes))
            bg_processor = BackgroundProcessor(ResumeProcessor())
            job_skills = await _get_job_skills(db, job_id)

            for resume in all_matched_resumes:
                try:
                    # Get score from DB
                    score_val = 0.0
                    async with async_session_maker() as dbs:
                        m_row = (await dbs.execute(
                            select(CrossJobMatch.match_score).where(
                                CrossJobMatch.resume_id == resume.id,
                                CrossJobMatch.matched_job_id == job_id
                            )
                        )).scalar()
                        score_val = float(m_row) if m_row is not None else 0.0

                    chunk_stmt = select(ResumeChunk.raw_text).where(ResumeChunk.resume_id == resume.id).limit(1)
                    raw_text = (await db.execute(chunk_stmt)).scalar() or ""
                    
                    clean_summary = dict(resume.parse_summary or {})
                    clean_summary.pop("analysis", None)
                    clean_summary.pop("processing", None)

                    insights = await bg_processor.processor.generate_resume_insights(
                        raw_text=raw_text,
                        parsed_summary=clean_summary,
                        job=job,
                        job_skills=job_skills,
                        candidate_skills=_extract_skills(resume.parse_summary),
                    )
                    analysis_data = insights.get("analysis", {})

                    async with async_session_maker() as db2:
                        match_row = (await db2.execute(
                            select(CrossJobMatch).where(
                                CrossJobMatch.resume_id == resume.id,
                                CrossJobMatch.matched_job_id == job_id,
                            )
                        )).scalars().first()
                        if match_row:
                            match_row.match_analysis = analysis_data
                            flag_modified(match_row, "match_analysis")
                            
                            versioned = ResumeVersionResult(
                                resume_id=resume.id,
                                job_id=job_id,
                                job_version_number=job.version,
                                resume_score=match_row.match_score,
                                pass_fail="passed" if score_val >= (job.passing_threshold or 70.0) else "failed",
                                analysis_data=analysis_data,
                            )
                            db2.add(versioned)
                            await db2.commit()
                except Exception as e:
                    _log.warning("Failed AI analysis for resume %s: %s", resume.id, e)

            _log.info("New job matching complete for job_id=%s", job_id)


async def _get_job_skills(db, job_id: uuid.UUID) -> list:
    """Load job skills for analysis."""
    from sqlalchemy.orm import selectinload
    from app.v1.db.models.jobs import Job
    job = await db.scalar(
        select(Job).options(selectinload(Job.skills)).where(Job.id == job_id)
    )
    return job.skills if job else []


def _extract_skills(parse_summary: dict | None) -> list[str]:
    """Extract skill name strings from parse_summary."""
    if not parse_summary:
        return []
    skills = parse_summary.get("skills", [])
    result = []
    for s in skills:
        if isinstance(s, dict):
            text = s.get("text", "")
        else:
            text = str(s)
        for part in text.split(","):
            part = part.strip()
            if part and part.lower() not in ("not mentioned", "null", "none"):
                result.append(part)
    return result


cross_job_match_service = CrossJobMatchService()
