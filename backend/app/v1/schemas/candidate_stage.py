from datetime import datetime
from typing import Any, Optional
import uuid

from pydantic import BaseModel, ConfigDict


class CandidateStageSummary(BaseModel):
    """Minimal summary of a stage for embedding in candidate responses."""

    stage_id: uuid.UUID
    job_stage_id: uuid.UUID
    template_name: str
    status: str
    order: int
    job_id: uuid.UUID | None = None
    job_name: str | None = None
    completed_at: datetime | None = None
    completed: bool = False
    result: Optional[str] = None
    ai_result: Optional[str] = None
    hr_decision: Optional[str] = None
    evaluation_data: dict[str, Any] | None = None
    required_inputs: list[str] | None = None

    model_config = ConfigDict(from_attributes=True)
