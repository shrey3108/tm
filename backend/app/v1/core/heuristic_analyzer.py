"""
Heuristic-based resume-vs-JD analysis without LLM calls.
Uses a combination of bi-encoder semantic scores, skill overlap, and cross-encoder reranking.
"""

from __future__ import annotations

import math
import re
from typing import Any
import numpy as np
from sentence_transformers import CrossEncoder

from app.v1.core.config import settings
from app.v1.core.logging import get_logger

logger = get_logger(__name__)

class HeuristicAnalyzer:
    """Analyzer that uses local models and heuristics instead of LLMs."""

    def __init__(self) -> None:
        self.use_cross_encoder = settings.USE_CROSS_ENCODER
        self._cross_encoder = None

    @property
    def cross_encoder(self) -> CrossEncoder | None:
        if self.use_cross_encoder and self._cross_encoder is None:
            try:
                self._cross_encoder = CrossEncoder(settings.CROSS_ENCODER_MODEL_NAME)
            except Exception:
                logger.exception("Failed to load CrossEncoder model. Falling back to bi-encoder only.")
                self.use_cross_encoder = False
        return self._cross_encoder

    def _normalize_skills(self, skills: list[str | dict]) -> set[str]:
        """Convert a list of strings or dictionaries to a set of normalized strings."""
        normalized = set()
        for s in skills:
            if isinstance(s, dict):
                # Extract 'name' if it is a dict, fallback to first value or str representation
                name = str(s.get("name") or s.get("skill") or list(s.values())[0])
            else:
                name = str(s)
            
            # 1. Remove text in parentheses: "JavaScript (ES2022+)" -> "JavaScript "
            name = re.sub(r'\(.*?\)', '', name)
            # 2. Remove common trailing versioning/plus: "Java 17+" -> "Java ", "Node.js v14" -> "Node.js "
            name = re.sub(r'(\s+|v)\d+(\.\d+)*\+?$', '', name, flags=re.IGNORECASE)
            
            normalized.add(name.lower().strip())
        return normalized

    def _calculate_skill_overlap(self, job_skills: list[str], candidate_skills: list[str | dict]) -> float:
        """Calculate a percentage score based on missing/matched skills."""
        if not job_skills:
            return 100.0
        
        # Normalize for comparison
        j_skills = self._normalize_skills(job_skills)
        c_skills = self._normalize_skills(candidate_skills)
        
        matches = j_skills.intersection(c_skills)
        overlap = (len(matches) / len(j_skills)) * 100.0
        return overlap

    def analyze(
        self,
        *,
        resume_text: str,
        job_text: str,
        job_skills: list[str],
        candidate_skills: list[str],
        semantic_score: float,
        candidate_info: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Perform a local analysis without LLM calls."""
        
        # 1. Skill Overlap (0-100)
        skill_score = self._calculate_skill_overlap(job_skills, candidate_skills)
        
        # 2. Cross-Encoder Score (0-100 fallback)
        ce_score = semantic_score
        if self.cross_encoder:
            try:
                # Cross-encoder returns logits, need to sigmoid then scale
                logit = self.cross_encoder.predict([(resume_text, job_text)])[0]
                ce_score = (1 / (1 + math.exp(-logit))) * 100.0
            except Exception:
                logger.warning("Cross-encoder inference failed, using semantic_score.")
        
        # 3. Weighted Final Match Percentage
        # Priority: Skill overlap is very important for HR, Semantic is good for 'vibe'
        # Final = 40% Skills + 30% Bi-Vector + 30% Cross-Encoder
        final_match = (0.4 * skill_score) + (0.3 * semantic_score) + (0.3 * ce_score)
        final_match = min(100.0, max(0.0, final_match))
        
        # Determine missing skills using robust normalization
        j_skills_norm = self._normalize_skills(job_skills)
        c_skills_norm = self._normalize_skills(candidate_skills)
        
        # We check each original job skill against the normalized candidate set
        missing = []
        for s in job_skills:
            # Create a one-item set to use the same normalization logic
            s_norm_set = self._normalize_skills([s])
            if not s_norm_set or not list(s_norm_set)[0] in c_skills_norm:
                missing.append(s)
        
        # 4. Extract insights from candidate_info if available
        strength_summary = ""
        extraordinary_points = []
        
        if candidate_info:
            # Get professional summary from extraction
            summaries = candidate_info.get("professional_summary", [])
            if summaries:
                txt = str(summaries[0].get("text", "")).strip()
                if txt and txt.lower() != "not mentioned":
                    strength_summary = txt
            
            # Get extraordinary highlights from extraction (using semicolon separator)
            highlights = candidate_info.get("extraordinary_highlights", [])
            for h in highlights:
                txt = str(h.get("text", "")).strip()
                if txt and txt.lower() != "not mentioned":
                    # Switched to semicolon to avoid breaking on commas within sentences
                    extraordinary_points.extend([x.strip() for x in txt.split(";") if x.strip() and x.lower() != "not mentioned"])

        # 5. Generate Dynamic UI Feedback
        
        # Fallback for strength summary if LLM extraction didn't provide one
        if not strength_summary:
            matching_list = list(set(job_skills) - set(missing))
            if matching_list:
                strength_summary = f"Matching skills found: {', '.join(matching_list[:5])}."
            else:
                strength_summary = "No direct skill matches found in the resume."
            
        # Fallback for gap analysis
        if not job_skills:
            gap_analysis = "Analysis skipped: No mandatory skills were defined in the JD."
        elif not missing:
            gap_analysis = "No significant skill gaps identified relative to the mandatory requirements."
        else:
            gap_analysis = f"Missing key requirements: {', '.join(missing[:5])}."
            
        # 5. Extract Experience Summary from candidate_info
        experience_alignment = ""
        if candidate_info:
            exp_summaries = candidate_info.get("experience_summary", [])
            if exp_summaries:
                txt = str(exp_summaries[0].get("text", "")).strip()
                if txt and txt.lower() != "not mentioned":
                    experience_alignment = txt
        
        # Fallback for experience alignment
        if not experience_alignment:
            if semantic_score > 75:
                experience_alignment = "Strong alignment with the professional level and scope of the JD."
            elif semantic_score > 50:
                experience_alignment = "Moderate alignment found between professional history and core requirements."
            else:
                experience_alignment = "Limited professional background alignment detected for this specific role."

        return {
            "match_percentage": round(final_match, 1),
            "skill_gap_analysis": gap_analysis,
            "experience_alignment": experience_alignment,
            "strength_summary": strength_summary,
            "missing_skills": [{"name": s, "score": 0.0} for s in missing],
            "extraordinary_points": extraordinary_points,
            "custom_extractions": {}
        }

heuristic_analyzer = HeuristicAnalyzer()
