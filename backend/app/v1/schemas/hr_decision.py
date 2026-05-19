"""
Pydantic schemas for HR decision management.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, validator


class HRDecisionCreate(BaseModel):
    """Schema for creating a new HR decision."""

    decision: Literal["pass", "fail", "May Be"] = Field(
        ..., description="Decision value: pass, fail, or May Be"
    )
    notes: str | None = Field(
        None, 
        description="Optional notes for the decision. Required for 'May Be' decisions."
    )
    job_id: uuid.UUID | None = Field(
        None,
        description="Optional Job ID to link this decision to a specific job (e.g. for cross-matched candidates)."
    )
    stage_config_id: uuid.UUID | None = Field(
        None,
        description="Optional Stage Config ID to link this decision to a specific interview stage."
    )
    score: int | None = Field(
        None,
        ge=1,
        le=5,
        description="Score out of 5 (1 to 5). Required when decision is 'pass' or 'fail'."
    )

    @validator('notes', always=True)
    def validate_may_be_notes(cls, v, values):
        """Ensure notes are provided for 'May Be' decisions."""
        if values.get('decision') == 'May Be' and (not v or not v.strip()):
            raise ValueError('Notes are required when decision is "May Be"')
        return v

    @validator('score', always=True)
    def validate_score_requirement(cls, v, values):
        """Ensure score is provided when decision is 'pass' or 'fail'."""
        decision = values.get('decision')
        if decision in ['pass', 'fail'] and v is None:
            raise ValueError('Score is required when decision is "pass" or "fail"')
        return v

    model_config = ConfigDict(from_attributes=True)


class HRDecisionResponse(BaseModel):
    """Schema for HR decision response."""

    id: uuid.UUID
    candidate_id: uuid.UUID
    stage_config_id: uuid.UUID | None
    stage_name: str | None = None
    job_id: uuid.UUID | None = None
    user_id: uuid.UUID
    decision: str
    notes: str | None
    score: int | None = None
    decided_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HRDecisionHistoryResponse(BaseModel):
    """Schema for candidate decision history."""

    candidate_id: uuid.UUID
    decisions: list[HRDecisionResponse]
    total_decisions: int
    pass_count: int
    fail_count: int
    may_be_count: int

    model_config = ConfigDict(from_attributes=True)


class HRDecisionUpdate(BaseModel):
    """Schema for updating an existing HR decision."""

    decision: Literal["pass", "fail", "May Be"] = Field(
        ..., description="Updated decision value"
    )
    notes: str | None = Field(
        None,
        description="Updated notes for the decision"
    )
    stage_config_id: uuid.UUID | None = Field(
        None,
        description="Updated Stage Config ID"
    )
    score: int | None = Field(
        None,
        ge=1,
        le=5,
        description="Updated score out of 5 (1 to 5). Required when decision is 'pass' or 'fail'."
    )

    @validator('notes', always=True)
    def validate_may_be_notes(cls, v, values):
        """Ensure notes are provided for 'May Be' decisions."""
        if values.get('decision') == 'May Be' and (not v or not v.strip()):
            raise ValueError('Notes are required when decision is "May Be"')
        return v

    @validator('score', always=True)
    def validate_score_requirement(cls, v, values):
        """Ensure score is provided when decision is 'pass' or 'fail'."""
        decision = values.get('decision')
        if decision in ['pass', 'fail'] and v is None:
            raise ValueError('Score is required when decision is "pass" or "fail"')
        return v

    model_config = ConfigDict(from_attributes=True)


class HRDecisionSummary(BaseModel):
    """Summary of HR decisions — overall counts per status (global or per-job)."""

    total_candidates: int = Field(..., description="Total candidates with at least one decision")
    passed_count: int = Field(..., description="Candidates passed/proceeded")
    failed_count: int = Field(..., description="Candidates failed")
    maybe_count: int = Field(..., description="Candidates marked as 'May Be'")
    undecided_count: int = Field(..., description="Candidates with no decision yet (total resumes - decided)")

    model_config = ConfigDict(from_attributes=True)


class HRJobDecisionSummary(BaseModel):
    """Summary of HR decisions for a specific job."""

    job_id: uuid.UUID
    total_candidates: int
    passed_count: int
    failed_count: int
    maybe_count: int
    undecided_count: int

    model_config = ConfigDict(from_attributes=True)
