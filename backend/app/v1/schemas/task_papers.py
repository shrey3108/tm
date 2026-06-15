from __future__ import annotations
import uuid
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator


class QuestionSetPaperCreate(BaseModel):
    name: str = Field(..., description="Name/title of the question set paper")
    job_id: uuid.UUID = Field(..., description="The associated job ID")
    position_id: uuid.UUID = Field(..., description="The associated job position level ID")
    questions: list[str] = Field(..., description="Questions for this paper")
    project_task: str = Field(..., description="The project task description")


class QuestionAction(BaseModel):
    question: str = Field(..., description="The content of the question")


class QuestionSetPaperRead(BaseModel):
    id: uuid.UUID
    name: str
    job_id: uuid.UUID
    position_id: uuid.UUID
    questions: list[str]
    project_task: str
    task_file_path: Optional[str] = None
    task_skills: Optional[list[str]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CandidateTestPaperRead(BaseModel):
    id: uuid.UUID
    candidate_id: Optional[uuid.UUID] = None
    job_id: uuid.UUID
    position_id: uuid.UUID
    name: str
    questions: list[str]
    project_task: str
    task_file_path: Optional[str] = None
    task_skills: Optional[list[str]] = None
    email_sent_count: int = 0
    created_at: datetime
    job_default_paper_changed: bool = False
    job_default_paper_name: Optional[str] = None
    job_default_paper_id: Optional[uuid.UUID] = None

    class Config:
        from_attributes = True


class CandidateTestPaperHistoryRead(BaseModel):
    id: uuid.UUID
    candidate_id: uuid.UUID
    job_id: uuid.UUID
    name: str
    questions: list[str]
    project_task: str
    task_file_path: Optional[str] = None
    task_skills: Optional[list[str]] = None
    assigned_at: datetime
    user_id: Optional[uuid.UUID] = None

    class Config:
        from_attributes = True



class CandidateTestPaperAssign(BaseModel):
    candidate_id: Optional[uuid.UUID] = Field(None, description="The candidate's ID (optional if assigning job-level default)")
    job_id: Optional[uuid.UUID] = Field(None, description="The job ID (required if candidate_id is not provided)")
    mode: Literal["predefined", "random", "custom"] = Field(
        ..., description="The assignment mode: 'predefined', 'random', or 'custom'"
    )
    paper_id: Optional[uuid.UUID] = Field(
        None, description="The ID of the predefined QuestionSetPaper (required if mode is 'predefined')"
    )
    source_paper_ids: Optional[list[uuid.UUID]] = Field(
        None, description="List of paper IDs to randomly pick questions from (used in 'random' mode)"
    )
    base_paper_id: Optional[uuid.UUID] = Field(
        None, description="The ID of a base paper to inherit task file and skills from (used in 'custom' mode)"
    )
    questions: Optional[list[str]] = Field(
        None, description="Custom questions (required if mode is 'custom')"
    )
    project_task: Optional[str] = Field(
        None, description="The custom project task description (required if mode is 'custom')"
    )


class CandidateTestPaperEmailSend(BaseModel):
    candidate_email: str = Field(..., description="The candidate's email address to send the test paper to")
    paper_id: uuid.UUID = Field(..., description="The ID of the generated CandidateTestPaper to send")
    force: bool = Field(False, description="Force send the email even if it has already been sent before")


class CandidateTestPaperBulkEmailSend(BaseModel):
    candidate_ids: Optional[list[uuid.UUID]] = Field(None, description="List of candidate IDs to send the test paper to")
    candidate_emails: Optional[list[str]] = Field(None, description="List of candidate email addresses to send the test paper to")
    paper_id: uuid.UUID = Field(..., description="The ID of the CandidateTestPaper to send")
    force: bool = Field(False, description="Force send the emails even if they have already been sent before")
