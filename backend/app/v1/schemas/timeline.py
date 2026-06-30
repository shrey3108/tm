from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field
import uuid

class AssociateMarkEntry(BaseModel):
    """A single associate's weighted evaluation result for a stage."""
    associate_name: str
    marks: Optional[float] = None
    result: Optional[str] = None


class TimelineEvent(BaseModel):
    event_type: str  # "stage" or "decision"
    event_date: Optional[datetime] = None
    title: str
    description: Optional[str] = None
    result: Optional[str] = None
    ai_result: Optional[str] = None
    hr_decision: Optional[str] = None
    score: Optional[float] = None
    ai_score: Optional[float] = None
    hr_score: Optional[float] = None
    stage_id: Optional[uuid.UUID] = None
    stage_name: Optional[str] = None
    job_id: Optional[uuid.UUID] = None
    job_stage_config_id: Optional[uuid.UUID] = None
    metadata: Optional[dict[str, Any]] = None
    associate_marks: list[AssociateMarkEntry] = Field(
        default_factory=list,
        description="Associate evaluation marks (name: marks out of 5) for github+question round stages",
    )

class HiringTimelineResponse(BaseModel):
    candidate_id: uuid.UUID
    latest_decision: str = "Pending"
    current_stage: str = "Resume Screening"
    events: list[TimelineEvent]
