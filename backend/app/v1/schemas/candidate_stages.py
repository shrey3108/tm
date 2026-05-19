from typing import Literal, Dict, Optional, Any
from pydantic import BaseModel, Field, ConfigDict
import uuid
from datetime import datetime

class EvaluationRead(BaseModel):
    id: uuid.UUID
    interview_id: Optional[uuid.UUID] = None
    transcript_id: Optional[uuid.UUID] = None
    candidate_stage_id: uuid.UUID
    version: int = Field(1, validation_alias="attempt_number")
    overall_score: Optional[float] = None
    result: str = "fail"
    # Use the property for better structure/compatibility
    evaluation_data: Dict[str, Any] = Field(..., validation_alias="structured_evaluation_data")
    sim_jd_resume: Optional[float] = None
    sim_jd_transcript: Optional[float] = None
    sim_resume_transcript: Optional[float] = None
    created_at: datetime
    highlights: Optional[Dict[str, Any]] = None
    
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

class StageOverrideCreate(BaseModel):
    override_reason: str = Field(..., description="Mandatory reason for overriding the AI evaluation")
    override_recommendation: Optional[Literal["pass", "fail", "May Be"]] = Field(None, description="Override the AI's final recommendation")
    criterion_scores: Optional[Dict[str, float]] = Field(None, description="Optional override of specific criteria scores")

class StageDecisionCreate(BaseModel):
    decision: Literal["pass", "fail", "May Be"] = Field(..., description="Final decision for this stage")
    notes: Optional[str] = Field(None, description="Optional decision notes")
