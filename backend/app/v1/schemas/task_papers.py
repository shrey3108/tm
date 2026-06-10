from __future__ import annotations
import uuid
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator


class QuestionSetPaperCreate(BaseModel):
    name: str = Field(..., description="Name/title of the question set paper")
    job_id: uuid.UUID = Field(..., description="The associated job ID")
    position_id: uuid.UUID = Field(..., description="The associated job position level ID")
    questions: list[str] = Field(..., description="Exactly 5 questions for this paper")
    project_task: str = Field(..., description="The project task description")

    @field_validator("questions")
    @classmethod
    def validate_questions_count(cls, v: list[str]) -> list[str]:
        if len(v) != 5:
            raise ValueError("The questions list must contain exactly 5 items.")
        return v


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
    candidate_id: uuid.UUID
    job_id: uuid.UUID
    position_id: uuid.UUID
    name: str
    questions: list[str]
    project_task: str
    task_file_path: Optional[str] = None
    task_skills: Optional[list[str]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CandidateTestPaperAssign(BaseModel):
    candidate_email: str = Field(..., description="The candidate's email address")
    mode: Literal["predefined", "random", "custom"] = Field(
        ..., description="The assignment mode: 'predefined', 'random', or 'custom'"
    )
    paper_id: Optional[uuid.UUID] = Field(
        None, description="The ID of the predefined QuestionSetPaper (required if mode is 'predefined')"
    )
    questions: Optional[list[str]] = Field(
        None, description="Exactly 5 custom questions (required if mode is 'custom')"
    )
    project_task: Optional[str] = Field(
        None, description="The custom project task description (required if mode is 'custom')"
    )

    @field_validator("questions")
    @classmethod
    def validate_custom_questions(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is not None and len(v) != 5:
            raise ValueError("The custom questions list must contain exactly 5 items.")
        return v


class CandidateTestPaperEmailSend(BaseModel):
    candidate_email: str = Field(..., description="The candidate's email address to send the test paper to")
    paper_id: uuid.UUID = Field(..., description="The ID of the generated CandidateTestPaper to send")
