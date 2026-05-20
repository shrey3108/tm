from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel
import uuid

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
    metadata: Optional[dict[str, Any]] = None

class HiringTimelineResponse(BaseModel):
    candidate_id: uuid.UUID
    latest_decision: str = "Pending"
    current_stage: str = "Resume Screening"
    events: list[TimelineEvent]
