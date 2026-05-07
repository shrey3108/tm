
from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, Field

class CriterionBase(BaseModel):
    name: str = Field(..., description="Name of the evaluation criterion")
    description: str | None = Field(None, description="Detailed description of what this criterion evaluates")
    prompt_text: str | None = Field(None, description="The rubric/prompt text for the AI to follow")

class CriterionCreate(CriterionBase):
    pass

class CriterionUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    prompt_text: str | None = None

class CriterionRead(CriterionBase):
    id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True


class StageCriterionRead(BaseModel):
    """Criterion with its weight for a specific job stage."""
    id: uuid.UUID
    name: str
    description: str | None
    prompt_text: str | None
    weight: float
    is_active: bool

    class Config:
        from_attributes = True
