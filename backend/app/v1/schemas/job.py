"""
Pydantic schemas for Job-related data transfer.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from app.v1.schemas.department import DepartmentRead
from app.v1.schemas.job_stage import JobStageConfigRead
from app.v1.schemas.skill import SkillRead
from app.v1.schemas.job_priority import JobPriorityRead
from app.v1.schemas.job_position import JobPositionRead
from app.v1.schemas.associate import AssociateRead
from pydantic import BaseModel, ConfigDict, Field
from typing import Any


class JobBase(BaseModel):
    """
    Base schema for Job data with shared attributes.
    """

    processing_version: int | None = Field(None, json_schema_extra={"example": 1})
    title: str
    vacancy: int | None = None
    department_id: uuid.UUID | None = None
    jd_text: str | None = None
    jd_json: dict | None = None
    is_active: bool = True
    passing_threshold: float = 70.0
    question_bank_passing_threshold: float = 70.0
    custom_extraction_fields: list[str] | None = None
    priority_id: uuid.UUID | None = None
    associate_reminder_hours: int | None = Field(None, description="Hours between reminders for associates")
    position_id: uuid.UUID | None = None
    priority_start_date: datetime | None = None
    priority_end_date: datetime | None = None
    task_file_path: str | None = None
    task_skills: list[str] | None = None
    send_ai_evaluation_to_associate: bool = True


class StageInput(BaseModel):
    """
    Minimal stage definition for embedding in JobCreate.
    """
    template_id: uuid.UUID
    stage_order: int
    is_mandatory: bool = True
    is_default: bool = False
    config: dict[str, Any] | None = None


class JobCreate(JobBase):
    """
    Schema for creating a new Job.
    Optionally accepts a list of stages to configure at creation time.
    If stages is None (not provided), default stages will be auto-created.
    If stages is [] (empty list), no stages will be created.
    """

    position_id: uuid.UUID = Field(..., description="Position is required to create a job")
    skill_ids: list[uuid.UUID] = []
    associate_ids: list[uuid.UUID] = []
    skill_weightages: dict[uuid.UUID, float] | None = Field(None, description="Mapping of skill ID to its weightage")
    processing_version: int | None = Field(None, description="Pin to a specific job version for matching")
    stages: list[StageInput] | None = Field(
        default=None,
        json_schema_extra={
            "example": [
                {
                    "template_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                    "stage_order": 1,
                    "is_mandatory": True,
                    "config": {}
                }
            ]
        }
    )  # None = auto-defaults, [] = no stages


class JobUpdate(BaseModel):
    """
    Schema for updating an existing Job.
    """

    processing_version: int | None = Field(None, json_schema_extra={"example": 1})
    title: str | None = None
    vacancy: int | None = None
    department_id: uuid.UUID | None = None
    jd_text: str | None = None
    jd_json: dict | None = None
    is_active: bool | None = None
    skill_ids: list[uuid.UUID] | None = None
    associate_ids: list[uuid.UUID] | None = None
    skill_weightages: dict[uuid.UUID, float] | None = Field(None, description="Mapping of skill ID to its weightage")

    passing_threshold: float | None = None
    question_bank_passing_threshold: float | None = None
    custom_extraction_fields: list[str] | None = None
    priority_id: uuid.UUID | None = None
    associate_reminder_hours: int | None = Field(None, description="Hours between reminders for associates")
    position_id: uuid.UUID | None = None
    priority_start_date: datetime | None = None
    priority_end_date: datetime | None = None
    stages: list[StageInput] | None = None
    task_file_path: str | None = None
    task_skills: list[str] | None = None
    send_ai_evaluation_to_associate: bool | None = None


class JobStatusUpdate(BaseModel):
    """
    Schema for updating only the job's active status.
    """

    is_active: bool


class JobVersionMinimal(BaseModel):
    """
    Minimal schema for a Job version, showing only version number and its unique ID.
    """

    version_num: int
    id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)


class JobVersionRead(BaseModel):
    """
    Schema for reading full Job version snapshot data.
    """

    id: uuid.UUID
    job_id: uuid.UUID
    version_number: int
    title: str
    vacancy: int | None = None
    jd_text: str | None = None
    jd_json: dict | None = None
    custom_extraction_fields: list[str] | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class JobRead(JobBase):
    """
    Schema for reading Job data, including database-generated fields.
    """

    id: uuid.UUID
    version: int = 1
    total_versions: int = 0
    job_versions: list[JobVersionMinimal] = []
    created_by: uuid.UUID | None = None
    created_at: datetime
    department_name: str | None = None
    department: DepartmentRead | None = None
    skills: list[SkillRead] = []
    associates: list[AssociateRead] = []
    job_skill_weightages: dict[uuid.UUID, float] | None = Field(default=None, description="Mapping of skill ID to its weightage for this job")
    stages: list[JobStageConfigRead] = []
    priority: JobPriorityRead | None = None
    position: JobPositionRead | None = None
    decision_summary: dict | None = None
    automated_screening_summary: dict | None = None
    total_candidates: int | None = None
    current_session_candidates: int | None = None
    activity_sessions: list[JobActivitySession] | None = None
    default_paper_assigned: bool = False
    message: str | None = None

    model_config = ConfigDict(from_attributes=True)


class JobsListRead(BaseModel):
    """
    Schema for a paginated list of jobs.
    """

    data: list[JobRead]
    total: int
    global_decision_summary: dict | None = None
    global_screening_summary: dict | None = None

class JobActivitySession(BaseModel):
    """
    Schema for a single job activation session.
    Represents a period where the job was active.
    """

    session_id: int
    start_date: datetime
    end_date: datetime | None = None
    candidate_count: int
    passed_count: int = 0
    failed_count: int = 0
    pending_count: int = 0
    is_current: bool

    model_config = ConfigDict(from_attributes=True)


class JobActivityHistoryResponse(BaseModel):
    """
    Response schema for job activity history.
    """

    job_id: uuid.UUID
    total_candidates: int
    sessions: list[JobActivitySession]

    model_config = ConfigDict(from_attributes=True)


class JobTitleRead(BaseModel):
    """
    Minimal schema for a Job, showing only its unique ID and title.
    """

    id: uuid.UUID
    title: str

    model_config = ConfigDict(from_attributes=True)


class JobTitlesListRead(BaseModel):
    """
    Schema for a list of job titles.
    """

    data: list[JobTitleRead]


class JobTaskRead(BaseModel):
    """
    Schema for reading a job's task file path and extracted skills.
    """

    task_file_path: str | None = None
    task_skills: list[str] | None = None

    model_config = ConfigDict(from_attributes=True)


# --- Grouped Job Titles (title → variants) ---

class JobTitleVariantRead(BaseModel):
    """
    A single variant under a job title group, identified by its unique (job_id, position_id).
    """

    job_id: uuid.UUID
    position_id: uuid.UUID
    position_name: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class JobTitleGroupRead(BaseModel):
    """
    A job title with all its position variants grouped together.
    """

    title: str
    variants: list[JobTitleVariantRead]


class JobTitlesGroupedListRead(BaseModel):
    """
    Schema for a list of grouped job titles.
    """

    data: list[JobTitleGroupRead]
