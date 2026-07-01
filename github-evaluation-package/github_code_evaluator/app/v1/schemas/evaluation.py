from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class RepositorySubmitRequest(BaseModel):
    """Payload to submit a GitHub repository for evaluation."""

    github_url: str = Field(
        ...,
        examples=["https://github.com/AtulPal31/medical-chatbot-mvp"],
        description="Public or accessible HTTP/HTTPS URL of the candidate repository",
    )
    job_title: str = Field(
        ...,
        examples=["Python AI Engineer"],
        description="The target job role for the evaluation scoring context",
    )
    job_position: Optional[str] = Field(
        None,
        description="The position level (e.g., Intern, Junior, Senior, Staff) to bound the seniority estimate.",
    )
    jd_skills: Optional[List[str]] = Field(
        None,
        description="Optional list of specific job description skills to evaluate",
    )
    project_required_skills: Optional[List[str]] = Field(
        None,
        description="Optional list of project-specific document skills to evaluate",
    )
    candidate_email: Optional[str] = Field(
        "candidate@example.com",
        description="Optional candidate email address to dispatch notifications",
    )
    recruiter_email: Optional[str] = Field(
        None,
        description="Optional HR/recruiter email address to dispatch notifications. Defaults to settings.HR_EMAIL if not provided.",
    )

    @field_validator("github_url")
    @classmethod
    def validate_github_url(cls, v: str) -> str:
        # Simple validation
        if not v.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")
        return v


class RepositorySubmitResponse(BaseModel):
    """Response returned after scheduling ingestion."""

    repository_id: UUID
    evaluation_id: UUID
    status: str
    message: str


class EvaluationStatusResponse(BaseModel):
    """Response showing status of evaluation."""

    evaluation_id: UUID
    status: str  # queued | processing | complete | failed
    overall_score: Optional[float] = None
    recommendation: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime


class ScoreDetail(BaseModel):
    score: float
    weight: float
    weighted_score: float


class SecurityFinding(BaseModel):
    file: str
    line: Optional[int] = None
    finding: str
    severity: str


class AlignmentReportResponse(BaseModel):
    jd_skills: Optional[List[str]] = None
    project_required_skills: Optional[List[str]] = None
    strengths: List[str] = []
    weaknesses: List[str] = []
    alignment_review: Optional[str] = None
    decision: Optional[str] = None
    interview_questions: List[str] = []
    jd_alignment_report: Optional[str] = None
    project_alignment_report: Optional[str] = None
    scores: Dict[str, ScoreDetail] = {}
    overall_score: Optional[float] = None
    correctness_review: Optional[str] = None
    code_quality_review: Optional[str] = None
    architecture_review: Optional[str] = None
    security_review: Optional[str] = None
    performance_review: Optional[str] = None
    documentation_review: Optional[str] = None


class ReportResponse(BaseModel):
    """Response payload containing the full evaluation report dashboard dataset."""

    evaluation_id: UUID
    repository_id: UUID
    github_url: str
    cloned_at: Optional[datetime] = None
    stack: Optional[Dict[str, List[str]]] = None
    status: str
    overall_score: Optional[float] = None
    recommendation: Optional[str] = None
    llm_model: Optional[str] = None
    prompt_version: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Meta
    seniority_estimate: Optional[str] = None

    # Dual Skill Evaluations
    jd_skills: Optional[List[str]] = None
    project_required_skills: Optional[List[str]] = None
    jd_alignment_report: Optional[str] = None
    project_alignment_report: Optional[str] = None
    jd_alignment: Optional[AlignmentReportResponse] = None
    project_alignment: Optional[AlignmentReportResponse] = None
    scores: Dict[str, float] = {}
    
    # Root qualitative reviews restored
    security_risks: List[str] = []
    architecture_review: Optional[str] = None
    code_quality_review: Optional[str] = None
    extraordinary_points: List[str] = []
    
    # Separate scores not averaged in overall score
    architecture_score: Optional[float] = None
    code_quality_score: Optional[float] = None
    security_score: Optional[float] = None
    extraordinary_score: Optional[float] = None

    # Security findings (regex/bandit findings)
    security_findings: List[SecurityFinding] = []


class ReviewerOverrideRequest(BaseModel):
    """Payload to override category scores and add audit log entry."""

    category: str = Field(
        ...,
        examples=["security"],
        description="The category score to override (e.g. correctness, code_quality, security)",
    )
    score: float = Field(
        ...,
        ge=0.0,
        le=10.0,
        examples=[8.5],
        description="The raw score to assign to this category (0.0 to 10.0)",
    )
    notes: str = Field(
        ...,
        min_length=5,
        examples=["Candidate uses dotenv, but missed sanitizing SQL inputs."],
        description="Auditable reviewer explanation for overriding the category score",
    )
