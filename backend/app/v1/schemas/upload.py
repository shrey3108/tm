"""
Upload schemas module.

This module defines Pydantic models for resume upload requests, responses,
and processing status information.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field
from app.v1.schemas.job import JobRead
from app.v1.schemas.candidate_stage import CandidateStageSummary


class ResumeProcessingInfo(BaseModel):
    """Information about the background processing status of a resume."""

    status: str
    error: str | None = None


class MissingSkill(BaseModel):
    """A single missing skill with its importance score."""

    name: str
    score: float = Field(ge=0, le=100)


class ResumeMatchAnalysis(BaseModel):
    """Structured analysis of a resume's match with a job description."""

    match_percentage: float = Field(ge=0, le=100)
    skill_gap_analysis: str
    experience_alignment: str
    strength_summary: str
    missing_skills: list[MissingSkill]
    extraordinary_points: list[str]
    custom_extractions: dict[str, str] | None = None


class ResumeUploadResponse(BaseModel):
    """Response returned after a resume is successfully uploaded."""

    message: str
    job_id: uuid.UUID
    candidate_id: uuid.UUID | None = None
    file_id: uuid.UUID
    resume_id: uuid.UUID
    file_name: str
    file_type: str
    size: int
    source_url: str
    parsed: bool
    processing: ResumeProcessingInfo
    analysis: ResumeMatchAnalysis | None = None
    version_results: list[dict] | None = None


class FailedUpload(BaseModel):
    """Information about a failed resume upload."""
    
    file_name: str
    error: str


class BulkResumeUploadResponse(BaseModel):
    """Response returned when a batch of resumes is uploaded."""
    
    successful: list[ResumeUploadResponse]
    failed: list[FailedUpload]



class ResumeStatusResponse(BaseModel):
    """Response containing the current status and analysis of a resume."""

    job_id: uuid.UUID
    candidate_id: uuid.UUID | None = None
    file_id: uuid.UUID
    resume_id: uuid.UUID
    file_name: str
    file_type: str
    size: int
    source_url: str
    parsed: bool
    processing: ResumeProcessingInfo
    analysis: ResumeMatchAnalysis | None = None
    version_results: list[dict] | None = None


class JobResumeInfoResponse(BaseModel):
    """Detailed information about a resume associated with a job."""

    job_id: uuid.UUID
    candidate_id: uuid.UUID | None = None
    candidate_first_name: str | None = None
    candidate_last_name: str | None = None
    candidate_email: str | None = None
    file_id: uuid.UUID
    resume_id: uuid.UUID
    file_name: str
    file_type: str
    size: int
    source_url: str
    uploaded_at: datetime
    parsed: bool
    processing: ResumeProcessingInfo
    analysis: ResumeMatchAnalysis | None = None
    resume_score: float | None = None
    pass_fail: str | None = None


class ResumeStatusUpdateRequest(BaseModel):
    """Request to update the manual review decision for a resume."""

    pass_fail: str | None = None


class JobResumesResponse(BaseModel):
    """Response containing a list of all resumes for a specific job."""

    job_id: uuid.UUID
    job: Optional["JobRead"] = None
    resumes: list[JobResumeInfoResponse]


class CandidateResponse(BaseModel):
    """Response representing a candidate and their resume status."""

    id: uuid.UUID
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    current_status: str | None = None
    created_at: datetime
    applied_job_id: uuid.UUID | None = None
    resume_id: uuid.UUID | None = None
    applied_version_number: int | None = None
    resume_analysis: ResumeMatchAnalysis | None = None
    resume_score: float | None = None
    pass_fail: str | None = None
    is_parsed: bool = False
    processing_status: str | None = None
    processing_error: str | None = None
    hr_decision: str | None = None
    hr_score: float | None = None
    job_id: uuid.UUID | None = None
    job_name: str | None = None
    is_cross_match: bool = False
    version_results: list[dict] | None = None
    current_stage: CandidateStageSummary | None = None
    pipeline: list[CandidateStageSummary] | None = None
    task_file_path: str | None = None
    task_skills: list[str] | None = None
    is_custom_task: bool = False
    github_evaluation_id: uuid.UUID | None = None
    email_sent_count: int = 0


# Alias for backward compatibility
CandidateRead = CandidateResponse


class CandidateTaskRead(BaseModel):
    """
    Schema for reading a candidate's task file path, extracted skills, and custom flag.
    """

    task_file_path: str | None = None
    task_skills: list[str] | None = None
    is_custom_task: bool = False

    model_config = ConfigDict(from_attributes=True)



class ResumeRead(BaseModel):
    """Schema for reading Resume data."""

    id: uuid.UUID
    candidate_id: uuid.UUID | None = None
    file_id: uuid.UUID
    parsed: bool
    uploaded_at: datetime
    parse_summary: dict | None = None
    resume_score: float | None = None
    pass_fail: str | None = None
    pass_threshold: float
    text_hash: str | None = None
    model_config = ConfigDict(from_attributes=True)


class JobCandidatesResponse(BaseModel):
    """Response containing a list of all candidates for a specific job."""

    job_id: uuid.UUID
    candidates: list[CandidateResponse]


class JobCandidateSkillsRead(BaseModel):
    """Schema for reading job standard skills and custom/fallback task skills."""

    job_skills: list[str] = []
    task_skills: list[str] = []

    model_config = ConfigDict(from_attributes=True)
