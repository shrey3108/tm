
import re
import numpy as np
from typing import List, Dict, Any, Tuple
import uuid
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.v1.core.embeddings import embedding_service
from app.v1.db.models.transcripts import Transcript
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.jobs import Job
from app.v1.db.models.candidate_stages import CandidateStage

logger = logging.getLogger(__name__)

class EvaluationEngine:
    """
    Hybrid scoring engine for candidate evaluation.
    Implements Embedding Phase, Reranker Phase, and Rule-based Scoring.
    """

    def calculate_cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        v1 = np.array(vec1)
        v2 = np.array(vec2)
        if v1.size == 0 or v2.size == 0:
            return 0.0
        dot = np.dot(v1, v2)
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        if norm1 < 1e-9 or norm2 < 1e-9:
            return 0.0
        return float(dot / (norm1 * norm2))

    def split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences using punctuation and newlines."""
        # Split by period, exclamation, or question mark followed by space/newline, OR just a newline
        sentences = re.split(r'(?<=[.!?])\s+|\n+', text)
        return [s.strip() for s in sentences if len(s.strip()) > 10]

    async def get_signals(
        self, 
        jd_text: str, 
        resume_text: str, 
        transcript_text: str,
        precalculated_transcript_vec: List[float] = None
    ) -> Dict[str, float]:
        """
        EMBEDDING PHASE: Generate semantic signals between JD, Resume, and Transcript.
        """
        import asyncio
        
        # JD and Resume are small, but we can still parallelize them
        tasks = [
            asyncio.to_thread(embedding_service.encode_jd, jd_text),
            asyncio.to_thread(embedding_service.encode_resume, resume_text)
        ]
        
        # Use precalculated vector for transcript if available, otherwise encode
        if precalculated_transcript_vec is not None:
            vec_jd, vec_resume = await asyncio.gather(*tasks)
            vec_transcript = precalculated_transcript_vec
        else:
            tasks.append(asyncio.to_thread(embedding_service.encode_transcript, transcript_text))
            vec_jd, vec_resume, vec_transcript = await asyncio.gather(*tasks)

        return {
            "profile_fit": self.calculate_cosine_similarity(vec_jd, vec_resume),
            "tech_alignment": self.calculate_cosine_similarity(vec_jd, vec_transcript),
            "consistency": self.calculate_cosine_similarity(vec_resume, vec_transcript)
        }

    async def extract_evidence(
        self, 
        transcript_text: str, 
        criterion_query: str, 
        top_k: int = 3, 
        precalculated_sentences: List[str] = None,
        precalculated_vectors: List[List[float]] = None
    ) -> List[str]:
        """
        RERANKER PHASE: Extract top-N evidence snippets for a criterion.
        """
        sentences = precalculated_sentences if precalculated_sentences is not None else self.split_into_sentences(transcript_text)
        if not sentences:
            return []

        # 1. Embed query
        query_vec = embedding_service.encode_transcript(criterion_query)
        
        # 2. Use precalculated vectors or embed in batch
        if precalculated_vectors is not None:
            sentence_vectors = precalculated_vectors
        else:
            sentence_vectors = embedding_service.encode_transcript_batch(sentences)
        
        sentence_scores: List[Tuple[str, float]] = []
        for sentence, s_vec in zip(sentences, sentence_vectors):
            score = self.calculate_cosine_similarity(query_vec, s_vec)
            sentence_scores.append((sentence, score))

        # 2. Sort and filter by threshold
        sentence_scores.sort(key=lambda x: x[1], reverse=True)
        
        # We use a threshold to avoid "junk" evidence when the topic isn't mentioned
        threshold = 0.35
        filtered_snippets = [s[0] for s in sentence_scores if s[1] >= threshold]
        
        return filtered_snippets[:top_k]

    def calculate_communication_penalty(self, transcript_text: str) -> float:
        """
        Rule-based scoring: Calculate penalty based on filler words.
        """
        # Using a subset of fillers for penalty calculation
        fillers = ["um", "uh", "like", "you know", "i mean", "actually", "basically"]
        words = transcript_text.lower().split()
        if not words:
            return 0.0
        
        count = 0
        for filler in fillers:
            count += transcript_text.lower().count(filler)
            
        # Arbitrary penalty logic: 1 filler per 20 words is 'normal' (5/5)
        # 1 filler per 5 words is 'poor' (1/5)
        filler_density = count / len(words)
        
        if filler_density <= 0.05: return 5.0
        if filler_density <= 0.10: return 4.0
        if filler_density <= 0.15: return 3.0
        if filler_density <= 0.20: return 2.0
        return 1.0

    def extract_salary_expectation(self, transcript_text: str) -> str:
        """
        Rule-based: Extract salary using regex.
        """
        pattern = r'(?:salary|expected|compensation|per annum|lpa|k|thousand|range)\s*(?:is|of|around|about|expecting)?\s*[\d,]+'
        match = re.search(pattern, transcript_text, re.IGNORECASE)
        return match.group(0) if match else "Not mentioned"

evaluation_engine = EvaluationEngine()
