import pytest
from github_code_evaluator.app.v1.services.scoring import ScoringService, DEFAULT_WEIGHTS


def test_calculate_scores_default():
    """Verify category scores and overall score calculation using defaults."""
    raw_scores = {
        "correctness": 4.0,
        "code_quality": 3.5,
        "architecture": 3.0,
        "security": 3.5,
        "performance": 3.0,
        "documentation": 4.0,
    }

    scores, overall = ScoringService.calculate_scores(raw_scores)

    assert overall == 3.8
    assert scores["correctness"]["score"] == 4.0
    assert scores["correctness"]["weight"] == 0.50
    assert scores["correctness"]["weighted_score"] == 2.0


def test_calculate_scores_with_secrets_penalty():
    """Verify that having secrets forces Security score to 1.0."""
    raw_scores = {
        "correctness": 4.0,
        "code_quality": 3.5,
        "architecture": 3.0,
        "security": 3.5,
        "performance": 3.0,
        "documentation": 4.0,
    }

    # Pass has_secrets=True
    scores, overall = ScoringService.calculate_scores(raw_scores, has_secrets=True)

    # Security score should be forced to 0.0
    assert scores["security"]["score"] == 0.0
    assert scores["security"]["weighted_score"] == 0.0
    # Overall score should remain 3.8 because security weight is 0.0
    assert overall == 3.8


def test_calculate_scores_custom_weights():
    """Verify scoring logic using customized category weights."""
    raw_scores = {
        "correctness": 4.0,
        "code_quality": 4.0,
        "architecture": 4.0,
        "security": 4.0,
        "performance": 4.0,
        "documentation": 4.0,
    }

    # Custom weights focusing highly on performance
    custom_weights = {
        "correctness": 0.10,
        "code_quality": 0.10,
        "architecture": 0.10,
        "security": 0.10,
        "performance": 0.55,
        "documentation": 0.05,
    }

    scores, overall = ScoringService.calculate_scores(
        raw_scores, custom_weights=custom_weights
    )

    assert overall == 4.0
    assert scores["performance"]["weight"] == 0.55
