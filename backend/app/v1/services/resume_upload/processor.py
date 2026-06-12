"""
Core processing logic for resumes (extraction, normalization, embeddings).
"""

from __future__ import annotations

import time
import uuid
import asyncio
from typing import Any

from app.v1.core.analyzer import ResumeJdAnalyzer
from app.v1.core.heuristic_analyzer import heuristic_analyzer
from app.v1.core.cache import cache
from app.v1.core.embeddings import embedding_service
from app.v1.core.config import settings
from app.v1.core.extractor import DocumentParser, ResumeLLMExtractor
from app.v1.utils.resume_upload import (
    normalize_extractions,
)
from app.v1.utils.text import (
    build_candidate_text,
    build_job_text,
    build_skill_text,
    split_into_chunks,
)

from .logging import log_stage, log_event
import logging
logger = logging.getLogger(__name__)


class ResumeProcessor:
    """Processor for extracting and analyzing resume data."""

    def __init__(self) -> None:
        self.extractor = ResumeLLMExtractor()
        self.analyzer = ResumeJdAnalyzer()

    def process_resume(
        self,
        file_path: str,
    ) -> tuple[str, dict[str, list[dict[str, object]]]]:
        """Extract and normalize data from a resume file.

        Args:
            file_path: Path to the resume file.

        Returns:
            A tuple containing (raw_text, normalized_extractions).
        """
        stage_started_at = time.perf_counter()
        raw_text = DocumentParser.extract_text(file_path)
        log_stage(
            stage="document_text_extraction",
            started_at=stage_started_at,
            file_path=file_path,
            chars=len(raw_text),
        )

        stage_started_at = time.perf_counter()
        extracted = self.extractor.extract_resume_info(raw_text)
        log_stage(
            stage="llm_resume_extraction",
            started_at=stage_started_at,
            file_path=file_path,
            chars=len(raw_text),
        )

        stage_started_at = time.perf_counter()
        normalized = normalize_extractions(extracted)
        log_stage(
            stage="normalize_extractions",
            started_at=stage_started_at,
            file_path=file_path,
        )
        return raw_text, normalized

    async def generate_resume_insights(
        self,
        *,
        raw_text: str,
        parsed_summary: dict[str, object],
        job: Any,
        job_skills: list[Any],
        candidate_skills: list[str],
    ) -> dict[str, object]:
        """Generate vector embeddings and LLM analysis for a resume compared to a job.

        Args:
            raw_text: Raw text of the resume.
            parsed_summary: Structured data from the resume.
            job: The job object.
            job_skills: List of skills required for the job.
            candidate_skills: List of skills extracted from the resume.

        Returns:
            A dictionary containing embeddings and the match analysis.
        """
        candidate_text = build_candidate_text(parsed_summary, raw_text)
        job_text = build_job_text(job)
        job_id = getattr(job, "id", None)

        job_version = getattr(job, "version", 1)

        # 1. Parallelize Job and Candidate Embeddings
        async def get_job_embedding():
            # ---- Redis Cache for Job Embedding ----
            nonlocal job_embedding
            if job_id:
                cache_key = f"job_embedding:{job_id}_v{job_version}"
                job_embedding = await cache.get(cache_key)
                if job_embedding:
                    log_event(event="job_embedding_cache_hit", job_id=job_id)

            if job_embedding is None or len(job_embedding) != embedding_service.target_dim:
                if job_embedding:
                    log_event(event="job_embedding_dim_mismatch", job_id=job_id, cache_dim=len(job_embedding), target_dim=embedding_service.target_dim)
                
                stage_started_at = time.perf_counter()
                job_embedding = await asyncio.to_thread(embedding_service.encode_jd, job_text) if job_text else None
                log_stage(stage="job_embedding_generated", started_at=stage_started_at, job_chars=len(job_text) if job_text else 0)
                if job_id and job_embedding:
                    await cache.set(f"job_embedding:{job_id}_v{job_version}", job_embedding)
            return job_embedding

        logger.info("[INSIGHTS] Parallelizing Initial Embeddings for resume_id=%s", getattr(job, "id", "unknown"))
        
        # Run JD and Candidate embedding in parallel
        job_emb_task = get_job_embedding()
        cand_emb_task = asyncio.to_thread(embedding_service.encode_resume, candidate_text) if candidate_text else asyncio.sleep(0, None)
        
        job_embedding, candidate_embedding = await asyncio.gather(job_emb_task, cand_emb_task)
        
        # 2. Semantic Score (Needed for LLM)
        semantic_score = embedding_service.get_semantic_score_from_embeddings(
            candidate_embedding or [],
            job_embedding or [],
        )

        # 3. Parallelize Chunk Embeddings, Skill Embeddings, and LLM Analysis
        async def get_chunk_embeddings():
            raw_chunks = split_into_chunks(raw_text) or [candidate_text]
            chunk_texts = [chunk_txt for chunk_txt in raw_chunks]
            chunk_vectors = await asyncio.to_thread(embedding_service.encode_resume_batch, chunk_texts) if chunk_texts else []
            return [{"text": txt, "embedding": vec} for txt, vec in zip(chunk_texts, chunk_vectors)]

        async def get_skill_embeddings():
            skills_to_encode = []
            skill_ids = []
            for skill in job_skills:
                if getattr(skill, "skill_embedding", None) is not None: continue
                skill_text = build_skill_text(skill)
                if skill_text:
                    skills_to_encode.append(skill_text)
                    skill_ids.append(skill.id)
            if not skills_to_encode: return {}
            encoded_vectors = await asyncio.to_thread(embedding_service.encode_skills_batch, skills_to_encode)
            return {sid: vec for sid, vec in zip(skill_ids, encoded_vectors)}

        async def get_llm_analysis():
            return await asyncio.to_thread(
                self.analyzer.analyze,
                raw_text=raw_text,
                candidate_info=parsed_summary,
                job_title=getattr(job, "title", "Job Description")[:150],
                job_skills=[skill.name for skill in job_skills],
                job_description=getattr(job, "jd_text", None),
                candidate_skills=candidate_skills,
                semantic_score=semantic_score,
            )

        logger.info("[INSIGHTS] Parallelizing Analysis and Final Embeddings for resume_id=%s", getattr(job, "id", "unknown"))
        
        chunk_task = get_chunk_embeddings()
        skill_task = get_skill_embeddings()
        analysis_task = get_llm_analysis()
        
        chunk_embeddings, extra_skill_embeddings, analysis = await asyncio.gather(
            chunk_task, skill_task, analysis_task
        )

        return {
            "job_embedding": job_embedding,
            "candidate_embedding": candidate_embedding,
            "chunk_embeddings": chunk_embeddings,
            "skill_embeddings": extra_skill_embeddings,
            "analysis": analysis,
        }

    def generate_skill_embeddings(
        self,
        skills: list[Any],
    ) -> dict[uuid.UUID, list[float]]:
        """Generate embeddings for a list of candidate skills.

        Args:
            skills: List of Skill objects.

        Returns:
            Dictionary mapping skill IDs to their generated embeddings.
        """
        embeddings: dict[uuid.UUID, list[float]] = {}
        stage_started_at = time.perf_counter()
        skills_to_encode = []
        skill_ids = []
        for skill in skills:
            if getattr(skill, "skill_embedding", None) is not None:
                continue
            skill_text = build_skill_text(skill)
            if skill_text:
                skills_to_encode.append(skill_text)
                skill_ids.append(skill.id)

        if skills_to_encode:
            encoded_vectors = embedding_service.encode_skills_batch(skills_to_encode)
            for sid, vec in zip(skill_ids, encoded_vectors):
                embeddings[sid] = vec

        log_stage(
            stage="candidate_skill_embeddings_internal",
            started_at=stage_started_at,
            generated=len(embeddings),
            total_skills=len(skills),
        )
        return embeddings
