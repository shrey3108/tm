"""
Pydantic schemas for Job Stage and Stage Template data transfer.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StageTemplateBase(BaseModel):
    """Base schema for Stage Template data."""

    name: str = Field(..., description="Name of the stage template")
    is_default: bool = Field(False, description="Whether this stage is automatically assigned to new jobs")
    default_order: int | None = Field(None, description="The default position of this stage in a new pipeline")
    description: str | None = Field(
        None, description="Detailed description of the stage"
    )
    config: dict[str, Any] | None = Field(
        None, 
        description="Default configuration JSON for this stage type",
        validation_alias="default_config",
        serialization_alias="config"
    )

    @model_validator(mode="before")
    @classmethod
    def ensure_config_is_populated(cls, data: Any) -> Any:
        """Fail-safe to ensure config is populated from default_config."""
        if hasattr(data, "default_config") and not isinstance(data, dict):
            # ORM object case: Force conversion to dict
            val = getattr(data, "default_config", None)
            
            fields = ["id", "name", "description", "is_default", "default_order", "created_at"]
            data_dict = {}
            for field in fields:
                if hasattr(data, field):
                    data_dict[field] = getattr(data, field)
            
            # 🌟 THE TRICK: Set both to be absolutely sure Pydantic sees it
            data_dict["config"] = val
            data_dict["default_config"] = val
            return data_dict
            
        elif isinstance(data, dict):
            # Dictionary case
            val = data.get("default_config") or data.get("config")
            if val is not None:
                data["config"] = val
                data["default_config"] = val
        return data


class StageTemplateCreate(StageTemplateBase):
    """Schema for creating a new Stage Template."""

    pass


class StageTemplateUpdate(BaseModel):
    """Schema for updating an existing Stage Template."""

    name: str | None = None
    description: str | None = None
    config: dict[str, Any] | None = Field(
        None, 
        description="Default configuration JSON for this stage type",
        validation_alias="default_config"
    )
    is_default: bool | None = None
    default_order: int | None = None


class StageTemplateRead(StageTemplateBase):
    """Schema for reading Stage Template data."""

    id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class JobStageConfigBase(BaseModel):
    """Base schema for Job Stage Configuration data."""

    stage_order: int = Field(
        ..., ge=0, description="Sequence order of this stage"
    )
    config: dict[str, Any] | None = Field(
        None, description="Job-specific configuration for this stage"
    )
    is_mandatory: bool = Field(
        True, description="Whether this stage is required"
    )
    is_default: bool = Field(
        False, description="Whether this stage is the default starting point for new candidates"
    )


class JobStageConfigCreate(JobStageConfigBase):
    """Schema for adding a stage to a job."""

    template_id: uuid.UUID = Field(..., description="ID of the template to use")


class JobStageBulkCreate(BaseModel):
    """Schema for bulk adding stages to a job."""

    stages: list[JobStageConfigCreate] = Field(
        ..., min_length=1, description="List of stages to configure"
    )


class JobStageConfigUpdate(BaseModel):
    """Schema for updating a job-specific stage configuration."""

    stage_order: int | None = Field(None, ge=0)
    config: dict[str, Any] | None = None
    is_mandatory: bool | None = None
    is_default: bool | None = None


class JobStageConfigRead(JobStageConfigBase):
    """Schema for reading Job Stage Configuration data."""

    id: uuid.UUID
    job_id: uuid.UUID
    template_id: uuid.UUID
    template: StageTemplateRead
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class JobStageReorder(BaseModel):
    """Schema for reordering stages within a job."""

    stage_ids: list[uuid.UUID] = Field(
        ..., description="Ordered list of JobStageConfig IDs"
    )


class StageEvaluationRead(BaseModel):
    """Schema for reading Stage Evaluation data."""

    id: uuid.UUID
    candidate_id: uuid.UUID
    job_stage_config_id: uuid.UUID
    status: str
    analysis: dict[str, Any] | None = None
    decision: bool | None = None
    created_at: datetime
    completed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
    
class StageTemplatesListRead(BaseModel):
    """Schema for a paginated list of stage templates."""
    data: list[StageTemplateRead]
    total: int
