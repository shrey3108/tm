"""
Admin Schemas Module.

Provides Pydantic models for admin operations including user management,
role management, permission management, audit logs, and analytics reporting.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class PermissionBase(BaseModel):
    """Base model for permission data."""

    name: str
    description: str


class PermissionCreate(PermissionBase):
    """Model for creating a new permission."""

    pass


class PermissionRead(PermissionBase):
    """Model for reading permission data."""

    id: uuid.UUID
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class RoleBase(BaseModel):
    """Base model for role data."""

    name: str


class RoleCreate(RoleBase):
    """Model for creating a new role."""

    permission_ids: list[uuid.UUID] = []


class RoleUpdate(BaseModel):
    """Model for updating an existing role."""

    name: str | None = None
    permission_ids: list[uuid.UUID] | None = None


class RoleRead(RoleBase):
    """Model for reading role data."""

    id: uuid.UUID
    created_at: datetime | None = None
    updated_at: datetime | None = None
    user_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class RoleWithPermissions(RoleRead):
    """Model for reading role data with associated permissions."""

    permissions: list[PermissionRead] = []

    model_config = ConfigDict(from_attributes=True)


class UserAdminCreate(BaseModel):
    """Model for creating a new user via admin."""

    email: EmailStr
    password: str
    full_name: str | None = None
    is_active: bool = True
    role_id: uuid.UUID


class UserAdminUpdate(BaseModel):
    """Model for updating an existing user via admin."""

    full_name: str | None = None
    is_active: bool | None = None
    role_id: uuid.UUID | None = None


class UserAdminRead(BaseModel):
    """Model for reading user data via admin."""

    id: uuid.UUID
    full_name: str | None = None
    email: EmailStr
    is_active: bool
    role_id: uuid.UUID | None = None
    role_name: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class UserWithRole(UserAdminRead):
    """Model for reading user data with associated role."""

    role: RoleRead

    model_config = ConfigDict(from_attributes=True)


class AuditLogRead(BaseModel):
    """Model for reading audit log data."""

    id: uuid.UUID
    user_id: uuid.UUID
    user_name: str | None = None
    action: str
    target_type: str | None = None
    target_id: uuid.UUID | None = None
    details: dict | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AuditLogWithUser(AuditLogRead):
    """Model for reading audit log data with associated user."""

    user: UserAdminRead

    model_config = ConfigDict(from_attributes=True)


class RecentUploadRead(BaseModel):
    """Model for reading recent file upload data."""

    id: uuid.UUID
    file_name: str | None = None
    file_type: str | None = None
    size: int | None = None
    candidate_id: uuid.UUID | None = None
    candidate_name: str | None = None
    job_id: uuid.UUID | None = None
    uploaded_by: uuid.UUID = Field(validation_alias="owner_id")
    uploader_name: str | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class RecentUploadWithDetails(RecentUploadRead):
    """Model for reading recent upload data with additional details."""

    candidate_name: str | None = None
    job_title: str | None = None
    uploader_email: str | None = None


class AnalyticsSummary(BaseModel):
    """Model for analytics summary statistics."""

    total_users: int
    total_roles: int
    total_permissions: int
    total_jobs: int
    total_candidates: int
    total_resumes: int
    total_passed: int
    total_failed: int
    total_pending: int
    total_unprocessed: int
    active_jobs: int
    active_users: int
    passed_count: int
    maybe_count: int
    failed_count: int
    hr_decision_count: int
    pending_decision_count: int


class JobCandidatesStats(BaseModel):
    """Model for candidate statistics per job."""

    job_id: uuid.UUID
    job_title: str
    department: str | None
    candidate_count: int
    passed_count: int = 0
    failed_count: int = 0


class PipelineStageStats(BaseModel):
    """Model for stage-level candidate counts."""

    stage_name: str
    order: int
    count: int


class JobPipelineStats(BaseModel):
    """Model for job-level pipeline statistics for charts."""

    job_id: uuid.UUID
    job_name: str
    stages: list[PipelineStageStats]


class HiringReport(BaseModel):
    """Model for hiring analytics report."""

    total_jobs: int
    active_jobs: int
    total_candidates: int
    total_passed: int
    total_failed: int
    total_pending: int
    total_unprocessed: int
    candidates_by_job: list[JobCandidatesStats]
    job_pipeline_stats: list[dict] = []
    resumes_uploaded_last_30_days: int
    average_resume_score: float | None
    hr_decided_count: int
    pending_count: int

