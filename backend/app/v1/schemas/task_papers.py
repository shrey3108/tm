from __future__ import annotations
import uuid
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator
from app.v1.schemas.skill import SkillRead


class MCQItem(BaseModel):
    question: str = Field(..., description="The MCQ question text")
    options: list[str] = Field(..., description="Options for the MCQ (e.g. four choices)")
    answer: Optional[str] = Field(None, description="The correct option / answer")


class TaskItem(BaseModel):
    task: str = Field(..., description="The main project task description or title")
    instructions: str = Field(..., description="Detailed instructions for the task")
    prerequisites: list[str] = Field(default_factory=list, description="Prerequisites or requirements for the task")


class QuestionSetPaperCreate(BaseModel):
    department_id: uuid.UUID = Field(..., description="The associated department ID")
    position_id: uuid.UUID = Field(..., description="The associated job position level ID")
    skill_ids: list[uuid.UUID] = Field(..., description="The associated skill IDs", min_length=1)
    paper_type: Literal["normal", "mcq", "task", "mixed"] = Field("mixed", description="The type of the paper")
    questions: list[str] = Field(default_factory=list, description="Questions for this paper")
    mcqs: list[MCQItem] = Field(default_factory=list, description="Multiple choice questions for this paper")
    project_task: list[TaskItem] = Field(default_factory=list, description="The structured project task definitions")

    @field_validator("project_task", mode="before")
    @classmethod
    def coerce_project_task(cls, v):
        if not v: return []
        if isinstance(v, str): v = [v] if v.strip() else []
        new_tasks = []
        for item in v:
            if isinstance(item, str):
                new_tasks.append({"task": item, "instructions": "", "prerequisites": []})
            else:
                new_tasks.append(item)
        return new_tasks


class QuestionAction(BaseModel):
    question: str = Field(..., description="The content of the question")

class MCQAction(BaseModel):
    mcq: dict = Field(..., description="The content of the multiple choice question")

class TaskAction(BaseModel):
    task: TaskItem = Field(..., description="The structured project task content")

    @field_validator("task", mode="before")
    @classmethod
    def coerce_task(cls, v):
        if isinstance(v, str):
            return {"task": v, "instructions": "", "prerequisites": []}
        return v


class QuestionSetPaperRead(BaseModel):
    id: uuid.UUID
    name: str
    department_id: uuid.UUID
    position_id: uuid.UUID
    skills: list[SkillRead] = Field(default_factory=list)
    paper_type: str
    questions: list[str]
    mcqs: list[MCQItem] = Field(default_factory=list)
    project_task: list[TaskItem] = Field(default_factory=list)
    task_file_path: Optional[str] = None
    task_skills: Optional[list[str]] = None
    created_at: datetime
    updated_at: datetime

    @field_validator("project_task", mode="before")
    @classmethod
    def coerce_project_task_to_list(cls, v):
        """Handle legacy DB rows and output structured objects."""
        if not v:
            return []
        if isinstance(v, str):
            return [{"task": v, "instructions": "", "prerequisites": []}] if v.strip() else []
            
        new_tasks = []
        for item in v:
            if isinstance(item, str):
                new_tasks.append({"task": item, "instructions": "", "prerequisites": []})
            elif isinstance(item, dict):
                if "task" not in item:
                    item["task"] = item.get("title", item.get("content", "Untitled Task"))
                if "instructions" not in item:
                    item["instructions"] = ""
                if "prerequisites" not in item:
                    item["prerequisites"] = []
                new_tasks.append(item)
            else:
                new_tasks.append(item)
        return new_tasks

    class Config:
        from_attributes = True

class QuestionSetPaperListRead(BaseModel):
    data: list[QuestionSetPaperRead]
    total: int


class CandidateTestPaperRead(BaseModel):
    id: uuid.UUID
    candidate_id: Optional[uuid.UUID] = None
    job_id: uuid.UUID
    position_id: uuid.UUID
    name: str
    questions: list[str]
    mcqs: list[MCQItem] = Field(default_factory=list)
    project_task: list[TaskItem]
    task_file_path: Optional[str] = None
    task_skills: Optional[list[str]] = None
    email_sent_count: int = 0
    created_at: datetime
    job_default_paper_changed: bool = False
    job_default_paper_name: Optional[str] = None
    job_default_paper_id: Optional[uuid.UUID] = None

    @field_validator("project_task", mode="before")
    @classmethod
    def coerce_project_task_to_list(cls, v):
        """Handle legacy DB rows and output structured objects."""
        if not v:
            return []
        if isinstance(v, str):
            return [{"task": v, "instructions": "", "prerequisites": []}] if v.strip() else []
            
        new_tasks = []
        for item in v:
            if isinstance(item, str):
                new_tasks.append({"task": item, "instructions": "", "prerequisites": []})
            elif isinstance(item, dict):
                if "task" not in item:
                    item["task"] = item.get("title", item.get("content", "Untitled Task"))
                if "instructions" not in item:
                    item["instructions"] = ""
                if "prerequisites" not in item:
                    item["prerequisites"] = []
                new_tasks.append(item)
            else:
                new_tasks.append(item)
        return new_tasks

    class Config:
        from_attributes = True


class CandidateTestPaperHistoryRead(BaseModel):
    id: uuid.UUID
    candidate_id: uuid.UUID
    job_id: uuid.UUID
    name: str
    questions: list[str]
    mcqs: list[MCQItem] = Field(default_factory=list)
    project_task: list[TaskItem]
    task_file_path: Optional[str] = None
    task_skills: Optional[list[str]] = None
    assigned_at: datetime
    user_id: Optional[uuid.UUID] = None

    @field_validator("project_task", mode="before")
    @classmethod
    def coerce_project_task_to_list(cls, v):
        """Handle legacy DB rows and output structured objects."""
        if not v:
            return []
        if isinstance(v, str):
            return [{"task": v, "instructions": "", "prerequisites": []}] if v.strip() else []
            
        new_tasks = []
        for item in v:
            if isinstance(item, str):
                new_tasks.append({"task": item, "instructions": "", "prerequisites": []})
            elif isinstance(item, dict):
                if "task" not in item:
                    item["task"] = item.get("title", item.get("content", "Untitled Task"))
                if "instructions" not in item:
                    item["instructions"] = ""
                if "prerequisites" not in item:
                    item["prerequisites"] = []
                new_tasks.append(item)
            else:
                new_tasks.append(item)
        return new_tasks

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
    mcqs: Optional[list[MCQItem]] = Field(
        None, description="Custom MCQs (used if mode is 'custom')"
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

class TaskPaperPreviewResponse(BaseModel):
    questions: list[str] = Field(default_factory=list, description="List of randomly selected questions with tech stack tags")
    mcqs: list[MCQItem] = Field(default_factory=list, description="List of randomly selected MCQs with tech stack tags")
    project_task: list[TaskItem] = Field(default_factory=list, description="List of randomly selected project tasks with tech stack tags")
