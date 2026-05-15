"""
Embedding generation and similarity scoring for resumes, JDs, and skills.
"""

from __future__ import annotations

from functools import lru_cache

import numpy as np
from sentence_transformers import SentenceTransformer

from app.v1.core.config import settings
from app.v1.prompts import (
    JD_INSTRUCTION,
    RESUME_INSTRUCTION,
    SKILL_INSTRUCTION,
)
from app.v1.core.observability import get_tracer

tracer = get_tracer("hiring-platform.embeddings")


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer | None:
    """Retrieve the shared singleton instance of the embedding model.

    Returns:
        The loaded SentenceTransformer model, or None if it fails to load.
    """
    try:
        return SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
    except Exception as e:
        # Log or print the warning. In a restricted environment, we fall back gracefully.
        print(f"WARNING: Could not load embedding model '{settings.EMBEDDING_MODEL_NAME}': {e}")
        return None


def preload_embedding_model() -> SentenceTransformer | None:
    """Explicitly trigger model loading.

    Returns:
        The loaded SentenceTransformer model, or None.
    """
    return get_current_model()


def get_current_model() -> SentenceTransformer | None:
    return get_embedding_model()


class EmbeddingService:
    """Service for generating and comparing text embeddings."""

    def __init__(self) -> None:
        self.target_dim = settings.EMBEDDING_VECTOR_DIM
        self.use_instructions = settings.EMBEDDING_USE_INSTRUCTIONS
        self.truncate_dim = settings.EMBEDDING_TRUNCATE_DIM

    @property
    def model(self) -> SentenceTransformer | None:
        """Lazily retrieve the embedding model."""
        return get_embedding_model()

    def _fit_vector_dim(self, vector: list[float]) -> list[float]:
        """Ensure the vector matches the configured target dimension.

        Truncates or pads the vector with zeros as needed, then L2 normalizes.

        Args:
            vector: The input embedding vector.

        Returns:
            The adjusted vector matching the target dimension.
        """
        if not vector:
            return [0.0] * self.target_dim

        if len(vector) > self.target_dim:
            vector = vector[: self.target_dim]
        elif len(vector) < self.target_dim:
            vector = vector + ([0.0] * (self.target_dim - len(vector)))
            
        arr = np.array(vector)
        norm = np.linalg.norm(arr)
        if norm > 1e-9:
            arr = arr / norm
        else:
            # Avoid division by zero, return zero vector of correct size
            return [0.0] * self.target_dim
        return arr.tolist()

    def _encode_text(self, text: str, instruction: str) -> list[float]:
        """Internal helper to encode text into a vector using an optional instruction.

        Args:
            text: The text string to encode.
            instruction: The task-specific instruction prefix.

        Returns:
            A list of floats representing the embedding vector.
        """
        normalized_text = text.strip().lower()
        if not normalized_text:
            return [0.0] * self.target_dim

        if self.model is None:
            # Return zero vector if model failed to load
            return [0.0] * self.target_dim

        payload = (
            instruction + normalized_text if self.use_instructions else normalized_text
        )
        vector = self.model.encode(
            payload,
            normalize_embeddings=True,
            truncate_dim=self.truncate_dim,
        )
        
        res_vector = self._fit_vector_dim(vector.tolist())
        return res_vector

    def encode_resume(self, text: str) -> list[float]:
        """Encode resume text into a vector embedding.

        Args:
            text: Raw or processed resume text.

        Returns:
            Embedding vector.
        """
        return self._encode_text(text, RESUME_INSTRUCTION)

    def encode_resume_batch(self, texts: list[str]) -> list[list[float]]:
        """Encode a list of resume chunks into vector embeddings in a batch.

        Args:
            texts: List of resume texts.

        Returns:
            List of embedding vectors.
        """
        return self._encode_text_batch(texts, RESUME_INSTRUCTION)

    def encode_jd(self, text: str) -> list[float]:
        """Encode job description text into a vector embedding.

        Args:
            text: Job description text.

        Returns:
            Embedding vector.
        """
        return self._encode_text(text, JD_INSTRUCTION)

    def encode_transcript(self, text: str) -> list[float]:
        """Encode interview transcript text into a vector embedding.

        Args:
            text: Transcript chunk text.

        Returns:
            Embedding vector.
        """
        return self._encode_text(text, "Represent this interview transcript chunk for retrieval: ")

    def encode_transcript_batch(self, texts: list[str]) -> list[list[float]]:
        """Encode a list of transcript chunks into vector embeddings in a batch.

        Args:
            texts: List of transcript texts.

        Returns:
            List of embedding vectors.
        """
        return self._encode_text_batch(texts, "Represent this interview transcript chunk for retrieval: ")

    def encode_skill(self, text: str) -> list[float]:
        """Encode skill name/description into a vector embedding.

        Args:
            text: Skill text.

        Returns:
            Embedding vector.
        """
        return self._encode_text(text, SKILL_INSTRUCTION)

    def _encode_text_batch(self, texts: list[str], instruction: str) -> list[list[float]]:
        """Internal helper to encode a batch of texts into vectors.

        Args:
            texts: List of text strings to encode.
            instruction: The task-specific instruction prefix.

        Returns:
            A list of embedding vectors.
        """
        if not texts:
            return []
        
        payloads = []
        for text in texts:
            normalized_text = text.strip().lower()
            if self.use_instructions:
                payloads.append(instruction + normalized_text)
            else:
                payloads.append(normalized_text)
        
        vectors = self.model.encode(
            payloads,
            normalize_embeddings=True,
            truncate_dim=self.truncate_dim,
        )
        return [self._fit_vector_dim(vector.tolist()) for vector in vectors]

    def encode_skills_batch(self, texts: list[str]) -> list[list[float]]:
        """Encode a list of skill names/descriptions into vector embeddings in a batch.

        Args:
            texts: List of skill texts.

        Returns:
            List of embedding vectors.
        """
        return self._encode_text_batch(texts, SKILL_INSTRUCTION)

    def get_semantic_score(self, resume_text: str, jd_text: str) -> float:
        """Calculate the semantic similarity score between resume and JD text.

        Encodes both texts and computes their cosine similarity (dot product of
        normalized vectors).

        Args:
            resume_text: The resume text.
            jd_text: The job description text.

        Returns:
            A score between 0.0 and 100.0.
        """
        if not resume_text.strip() or not jd_text.strip():
            return 0.0

        vec1 = np.array(self.encode_resume(resume_text))
        vec2 = np.array(self.encode_jd(jd_text))
        if vec1.size == 0 or vec2.size == 0:
            return 0.0
        score = float(np.dot(vec1, vec2))
        return round(max(0.0, score) * 100.0, 2)

    def get_semantic_score_from_embeddings(
        self,
        resume_embedding: list[float],
        jd_embedding: list[float],
    ) -> float:
        """Compute semantic score from pre-calculated embedding vectors.

        Args:
            resume_embedding: Pre-calculated resume vector.
            jd_embedding: Pre-calculated JD vector.

        Returns:
            A score between 0.0 and 100.0.
        """
        if resume_embedding is None or jd_embedding is None:
            return 0.0

        vec1 = np.array(resume_embedding)
        vec2 = np.array(jd_embedding)
        if vec1.size == 0 or vec2.size == 0:
            return 0.0
        
        if vec1.shape != vec2.shape:
            # This happens when the model dimension configuration changes (e.g. 384 vs 1024)
            # We log a warning and return 0.0 to prevent a crash.
            # The caller (Processor) is responsible for detecting and refreshing stale embeddings.
            from app.v1.core.logging import get_logger
            logger = get_logger(__name__)
            logger.warning(
                "Embedding dimension mismatch: resume_embedding=%s, jd_embedding=%s. Returning 0.0 score.",
                vec1.shape,
                vec2.shape
            )
            return 0.0
            
        score = float(np.dot(vec1, vec2))
        return round(max(0.0, score) * 100.0, 2)


embedding_service = EmbeddingService()
