"""
Pydantic schemas for associate review results.

Used by the GET /candidate-stages/{id}/associate-results endpoint to return
all associate evaluation records for a candidate stage.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class QuestionMark(BaseModel):
    """A single question/MCQ/task with its awarded marks."""

    item_type: str = Field("question", description="Type of item: 'question', 'mcq', or 'task'")
    question_text: str = Field(..., description="The question text")
    max_marks: Optional[float] = Field(None, description="Maximum marks for this question")
    awarded_marks: Optional[float] = Field(None, description="Marks awarded by the associate")
    skill_ids: Optional[list[str]] = Field(None, description="Skill UUIDs (as strings) tagged on this item, used for weighted marks")
    skill_weight: Optional[float] = Field(None, description="Normalized weight (0-100) of this item based on its skill weightage")
    weighted_marks: Optional[float] = Field(None, description="Skill-weighted marks awarded: (awarded/max) * skill_weight, or None if not computable")
    weighted_max: Optional[float] = Field(None, description="Skill-weighted max marks (= skill_weight when max_marks > 0), or None if not computable")


class AssociateReviewResult(BaseModel):
    """Result of a single associate's evaluation for a candidate stage."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    review_token: uuid.UUID = Field(..., description="The unique token used to construct the frontend review link")
    associate_id: uuid.UUID
    associate_name: str
    associate_email: str
    sent_at: datetime = Field(..., description="When the email was sent to the associate (start date)")
    submitted_at: Optional[datetime] = Field(None, description="When the associate submitted marks (end date, null if pending)")
    status: str = Field(..., description="'sent' = pending, 'submitted' = done")
    marks: Optional[list[QuestionMark]] = Field(None, description="Marks per question")
    total_marks: Optional[float] = Field(None, description="Sum of awarded marks")
    max_total_marks: Optional[float] = Field(None, description="Sum of max marks")
    percentage: Optional[float] = Field(None, description="Percentage score")
    result: Optional[str] = Field(None, description="'pass' / 'fail' / null")
    weighted_total: Optional[float] = Field(None, description="Skill-weighted total awarded marks (0-100 scale)")
    weighted_max: Optional[float] = Field(None, description="Skill-weighted max marks (100 when computable)")
    weighted_result_out_of_5: Optional[float] = Field(None, description="Weighted result converted to a scale of 5: (weighted_total / weighted_max) * 5")


class AssociateResultsResponse(BaseModel):
    """Response for GET /candidate-stages/{id}/associate-results."""

    candidate_stage_id: uuid.UUID
    candidate_name: str
    job_name: str
    department: str
    position: str
    github_url: Optional[str] = None
    reviews: list[AssociateReviewResult] = Field(default_factory=list)
    total_associates: int = Field(0, description="Total number of associates sent the paper")
    submitted_count: int = Field(0, description="Number of associates who have submitted marks")
