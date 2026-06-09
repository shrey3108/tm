
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

class CriterionVersionMinimal(BaseModel):
    """Minimal schema for a Criterion version, showing only version number and its unique ID."""
    version_num: int
    id: uuid.UUID

    class Config:
        from_attributes = True


class CriterionVersionRead(BaseModel):
    """Schema for reading full Criterion version snapshot data."""
    id: uuid.UUID
    criterion_id: uuid.UUID
    version_number: int
    name: str
    description: str | None = None
    prompt_text: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class CriterionRead(CriterionBase):
    id: uuid.UUID
    version: int = 1
    total_versions: int = 0
    criterion_versions: list[CriterionVersionMinimal] = []
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


class CriterionEnhanceRequest(BaseModel):
    name: str = Field(..., description="Name of the criterion")
    description: str = Field(..., description="A rough description of what this criterion evaluates. AI will convert it into a professional rubric.")


class CriterionEnhanceResponse(BaseModel):
    enhanced_prompt: str = Field(..., description="The enhanced rubric prompt text")

