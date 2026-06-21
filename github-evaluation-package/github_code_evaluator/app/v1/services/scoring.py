import logging
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# Default weights as defined in the system requirements (sums to 100%)
DEFAULT_WEIGHTS = {
    "correctness": 0.50,
    "code_quality": 0.0,
    "architecture": 0.0,
    "security": 0.0,
    "performance": 0.20,
    "documentation": 0.30,
}


class ScoringService:
    """Scoring service to calculate categories score, handle overrides and penalty checks."""

    @staticmethod
    def calculate_scores(
        raw_scores: Dict[str, float],
        has_secrets: bool = False,
        custom_weights: Optional[Dict[str, float]] = None,
    ) -> Tuple[Dict[str, Dict[str, float]], float]:
        """Compute the weighted scores per category and overall score.

        Args:
            raw_scores: Dict mapping category to raw score (0.0 - 10.0).
            has_secrets: Boolean indicating if plain-text secrets were detected.
            custom_weights: Optional custom category weights overriding defaults.

        Returns:
            Tuple: Detailed score dictionary and the final overall score.
        """
        weights = custom_weights or DEFAULT_WEIGHTS
        processed_scores = {}
        total_weighted = 0.0
        total_weight = 0.0

        categories = [
            "correctness",
            "code_quality",
            "architecture",
            "security",
            "performance",
            "documentation",
        ]

        for cat in categories:
            val = raw_scores.get(cat, 0.0)
            if isinstance(val, dict):
                raw_score = float(val.get("score", 0.0))
            else:
                raw_score = float(val)
            weight = float(weights.get(cat, 0.0))

            # Apply security penalty rule: force raw score to 0.0 if secrets are found
            if cat == "security" and has_secrets:
                logger.warning("Secret detected: forcing Security score to 0.0")
                raw_score = 0.0

            # Ensure bounds (0.0 to 5.0)
            raw_score = max(0.0, min(5.0, raw_score))

            weighted_score = raw_score * weight
            total_weighted += weighted_score
            total_weight += weight

            processed_scores[cat] = {
                "score": round(raw_score, 1),
                "weight": round(weight, 2),
                "weighted_score": round(weighted_score, 2),
            }

        # Normalize score if weights do not sum exactly to 1.0 (to protect against custom configuration mistakes)
        overall_score = 0.0
        if total_weight > 0:
            overall_score = round(total_weighted / total_weight, 1)

        return processed_scores, overall_score
