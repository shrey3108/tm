"""
Pydantic schemas for interview management.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class InterviewCreate(BaseModel):
    """Schema for creating a new interview session."""

    candidate_id: uuid.UUID
    job_id: uuid.UUID
    stage: int = 1


class InterviewRead(BaseModel):
    """Schema for reading interview details."""

    id: uuid.UUID
    candidate_id: uuid.UUID
    job_id: uuid.UUID
    interviewer_id: uuid.UUID
    stage: int
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InterviewDecision(BaseModel):
    """Schema for HR decision after reviewing interview results."""

    decision: Literal["pass", "fail"]
    notes: str | None = None


class InterviewListResponse(BaseModel):
    """Schema for listing interviews."""

    interviews: list[InterviewRead]
    total: int
