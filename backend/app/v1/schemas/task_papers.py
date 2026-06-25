from __future__ import annotations
import uuid
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator
from app.v1.schemas.skill import SkillRead


class QuestionItem(BaseModel):
    question: str = Field(..., description="The content of the question")
    duration: Optional[int] = Field(None, description="Duration in minutes")
    marks: Optional[int] = Field(None, description="Marks allocated")
    weightage: Optional[int] = Field(None, description="Weightage percentage")


class MCQItem(BaseModel):
    question: str = Field(..., description="The MCQ question text")
    options: list[str] = Field(..., description="Options for the MCQ (e.g. four choices)")
    answer: Optional[str] = Field(None, description="The correct option / answer")
    duration: Optional[int] = Field(None, description="Duration in minutes")
    marks: Optional[int] = Field(None, description="Marks allocated")
    weightage: Optional[int] = Field(None, description="Weightage percentage")


class SubTask(BaseModel):
    name: str = Field(..., description="The name or title of the sub-task")
    description: Optional[str] = Field(None, description="Description of the sub-task")
    marks: Optional[int] = Field(None, description="Marks allocated")
    weightage: Optional[int] = Field(None, description="Weightage percentage")


class TaskItem(BaseModel):
    # Old fields for backward compatibility
    task: Optional[str] = Field(None, description="The main project task description or title")
    instructions: Optional[str] = Field(None, description="Detailed instructions for the task")
    
    # New nested fields
    title: Optional[str] = Field(None, description="The overall title of the project")
    description: Optional[str] = Field(None, description="The overall description of the project")
    duration: Optional[int] = Field(None, description="Duration in minutes for the whole project")
    tasks: Optional[list[SubTask]] = Field(default_factory=list, description="List of sub-tasks for this project")


class QuestionSetPaperCreate(BaseModel):
    department_id: uuid.UUID = Field(..., description="The associated department ID")
    position_id: uuid.UUID = Field(..., description="The associated job position level ID")
    skill_ids: list[uuid.UUID] = Field(..., description="The associated skill IDs", min_length=1)
    paper_type: Literal["normal", "mcq", "task", "mixed"] = Field("mixed", description="The type of the paper")
    source_mix: Optional[list[SourceMixItem]] = Field(default_factory=list, description="List of items to mix from existing papers")
    questions: list[QuestionItem] = Field(default_factory=list, description="Questions for this paper")
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
                new_tasks.append({"task": item, "instructions": ""})
            else:
                new_tasks.append(item)
        return new_tasks

    @field_validator("questions", mode="before")
    @classmethod
    def coerce_questions_to_list(cls, v):
        if not v: return []
        new_questions = []
        for item in v:
            if isinstance(item, str):
                new_questions.append({"question": item})
            else:
                new_questions.append(item)
        return new_questions

    @field_validator("mcqs", mode="before")
    @classmethod
    def coerce_mcqs(cls, v):
        if not v: return []
        new_mcqs = []
        for item in v:
            if isinstance(item, dict) and "question" in item and "options" in item and "answer" in item:
                new_mcqs.append(item)
            else:
                new_mcqs.append(item)
        return new_mcqs

    @model_validator(mode="after")
    def validate_total_weightage(self):
        total_weightage = 0
        has_weightage = False
        
        for q in getattr(self, "questions", []) or []:
            if q.weightage is not None:
                total_weightage += q.weightage
                has_weightage = True
                
        for m in getattr(self, "mcqs", []) or []:
            if m.weightage is not None:
                total_weightage += m.weightage
                has_weightage = True
                
        for pt in getattr(self, "project_task", []) or []:
            if pt.tasks:
                for sub in pt.tasks:
                    if sub.weightage is not None:
                        total_weightage += sub.weightage
                        has_weightage = True
                        
        if has_weightage and total_weightage != 100:
            raise ValueError(f"Total weightage of all items must sum up to exactly 100%. Current sum is {total_weightage}%")
            
        return self



class SourceMixItem(BaseModel):
    paper_id: uuid.UUID = Field(..., description="The ID of the source QuestionSetPaper")
    question_indices: list[int] = Field(default_factory=list, description="Indices of questions to include")
    mcq_indices: list[int] = Field(default_factory=list, description="Indices of MCQs to include")
    task_indices: list[int] = Field(default_factory=list, description="Indices of project tasks to include")

class QuestionAction(BaseModel):
    question: QuestionItem = Field(..., description="The structured question content")

    @field_validator("question", mode="before")
    @classmethod
    def coerce_question(cls, v):
        if isinstance(v, str):
            return {"question": v}
        return v

class MCQAction(BaseModel):
    mcq: MCQItem = Field(..., description="The structured multiple choice question content")

    @field_validator("mcq", mode="before")
    @classmethod
    def coerce_mcq(cls, v):
        if isinstance(v, dict) and "question" in v and "options" in v and "answer" in v:
            return v
        return v

class TaskAction(BaseModel):
    task: TaskItem = Field(..., description="The structured project task content")

    @field_validator("task", mode="before")
    @classmethod
    def coerce_task(cls, v):
        if isinstance(v, str):
            return {"task": v, "instructions": ""}
        return v


class QuestionSetPaperRead(BaseModel):
    id: uuid.UUID
    name: str
    department_id: uuid.UUID
    position_id: uuid.UUID
    skills: list[SkillRead] = Field(default_factory=list)
    paper_type: str
    questions: list[QuestionItem]
    mcqs: list[MCQItem] = Field(default_factory=list)
    project_task: list[TaskItem] = Field(default_factory=list)
    task_file_path: Optional[str] = None
    task_skills: Optional[list[str]] = None
    created_at: datetime
    updated_at: datetime

    @field_validator("questions", mode="before")
    @classmethod
    def coerce_questions_to_list(cls, v):
        if not v:
            return []
        new_questions = []
        for item in v:
            if isinstance(item, str):
                new_questions.append({"question": item})
            else:
                new_questions.append(item)
        return new_questions

    @field_validator("project_task", mode="before")
    @classmethod
    def coerce_project_task_to_list(cls, v):
        """Handle legacy DB rows and output structured objects."""
        if not v:
            return []
        if isinstance(v, str):
            return [{"task": v, "instructions": ""}] if v.strip() else []
            
        new_tasks = []
        for item in v:
            if isinstance(item, str):
                new_tasks.append({"task": item, "instructions": ""})
            elif isinstance(item, dict):
                if "task" not in item:
                    item["task"] = item.get("title", item.get("content", "Untitled Task"))
                if "instructions" not in item:
                    item["instructions"] = ""
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
    questions: list[QuestionItem]
    mcqs: list[MCQItem] = Field(default_factory=list)
    project_task: list[TaskItem]
    task_file_path: Optional[str] = None
    task_skills: Optional[list[str]] = None
    email_sent_count: int = 0
    created_at: datetime
    job_default_paper_changed: bool = False
    job_default_paper_name: Optional[str] = None
    job_default_paper_id: Optional[uuid.UUID] = None

    @field_validator("questions", mode="before")
    @classmethod
    def coerce_questions_to_list(cls, v):
        if not v:
            return []
        new_questions = []
        for item in v:
            if isinstance(item, str):
                new_questions.append({"question": item})
            else:
                new_questions.append(item)
        return new_questions

    @field_validator("project_task", mode="before")
    @classmethod
    def coerce_project_task_to_list(cls, v):
        """Handle legacy DB rows and output structured objects."""
        if not v:
            return []
        if isinstance(v, str):
            return [{"task": v, "instructions": ""}] if v.strip() else []
            
        new_tasks = []
        for item in v:
            if isinstance(item, str):
                new_tasks.append({"task": item, "instructions": ""})
            elif isinstance(item, dict):
                if "task" not in item:
                    item["task"] = item.get("title", item.get("content", "Untitled Task"))
                if "instructions" not in item:
                    item["instructions"] = ""
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
    questions: list[QuestionItem]
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
            return [{"task": v, "instructions": ""}] if v.strip() else []
            
        new_tasks = []
        for item in v:
            if isinstance(item, str):
                new_tasks.append({"task": item, "instructions": ""})
            elif isinstance(item, dict):
                if "task" not in item:
                    item["task"] = item.get("title", item.get("content", "Untitled Task"))
                if "instructions" not in item:
                    item["instructions"] = ""
                new_tasks.append(item)
            else:
                new_tasks.append(item)
        return new_tasks

    class Config:
        from_attributes = True



class CandidateTestPaperAssign(BaseModel):
    candidate_id: Optional[uuid.UUID] = Field(None, description="The candidate's ID (optional if assigning job-level default)")
    job_id: Optional[uuid.UUID] = Field(None, description="The job ID (required if candidate_id is not provided)")
    mode: Literal["predefined", "random", "custom", "hybrid"] = Field(
        ..., description="The assignment mode: 'predefined', 'random', or 'custom'"
    )
    paper_id: Optional[uuid.UUID] = Field(
        None, description="The ID of the predefined QuestionSetPaper (required if mode is 'predefined')"
    )
    source_paper_ids: Optional[list[uuid.UUID]] = Field(
        None, description="List of paper IDs to randomly pick questions from (used in 'random' mode)"
    )
    source_mix: Optional[list[SourceMixItem]] = Field(default_factory=list, description="Mix items for hybrid mode")
    base_paper_id: Optional[uuid.UUID] = Field(
        None, description="The ID of a base paper to inherit task file and skills from (used in 'custom' mode)"
    )
    questions: Optional[list[QuestionItem]] = Field(
        None, description="Custom questions (required if mode is 'custom')"
    )
    mcqs: Optional[list[MCQItem]] = Field(
        None, description="Custom MCQs (used if mode is 'custom')"
    )
    project_task: Optional[list[TaskItem]] = Field(
        default_factory=list, description="The custom project task description (required if mode is 'custom')"
    )

    @field_validator("questions", mode="before")
    @classmethod
    def coerce_questions_to_list(cls, v):
        if not v:
            return []
        new_questions = []
        for item in v:
            if isinstance(item, str):
                new_questions.append({"question": item})
            else:
                new_questions.append(item)
        return new_questions

    @field_validator("project_task", mode="before")
    @classmethod
    def coerce_project_task_to_list(cls, v):
        """Handle legacy DB rows and output structured objects."""
        if not v:
            return []
        if isinstance(v, str):
            return [{"task": v, "instructions": ""}] if v.strip() else []
            
        new_tasks = []
        for item in v:
            if isinstance(item, str):
                new_tasks.append({"task": item, "instructions": ""})
            elif isinstance(item, dict):
                if "task" not in item:
                    item["task"] = item.get("title", item.get("content", "Untitled Task"))
                if "instructions" not in item:
                    item["instructions"] = ""
                new_tasks.append(item)
            else:
                new_tasks.append(item)
        return new_tasks

    @model_validator(mode="after")
    def validate_total_weightage(self):
        total_weightage = 0
        has_weightage = False
        
        for q in getattr(self, "questions", []) or []:
            if q.weightage is not None:
                total_weightage += q.weightage
                has_weightage = True
                
        for m in getattr(self, "mcqs", []) or []:
            if m.weightage is not None:
                total_weightage += m.weightage
                has_weightage = True
                
        for pt in getattr(self, "project_task", []) or []:
            if pt.tasks:
                for sub in pt.tasks:
                    if sub.weightage is not None:
                        total_weightage += sub.weightage
                        has_weightage = True
                        
        if getattr(self, "mode", None) == "hybrid":
            return self

        if has_weightage and total_weightage != 100:
            raise ValueError(f"Total weightage of all items must sum up to exactly 100%. Current sum is {total_weightage}%")
            
        return self


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
    questions: list[QuestionItem] = Field(default_factory=list, description="List of randomly selected questions with tech stack tags")
    mcqs: list[MCQItem] = Field(default_factory=list, description="List of randomly selected MCQs with tech stack tags")
    project_task: list[TaskItem] = Field(default_factory=list, description="List of randomly selected project tasks with tech stack tags")
