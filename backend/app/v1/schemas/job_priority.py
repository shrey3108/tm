import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class JobPriorityBase(BaseModel):
    duration_days: int
    associate_reminder_hours: int = 24


class JobPriorityCreate(JobPriorityBase):
    pass


class JobPriorityUpdate(BaseModel):
    duration_days: int | None = None
    associate_reminder_hours: int | None = None


class JobPriorityRead(JobPriorityBase):
    id: uuid.UUID
    name: str
    assigned_jobs_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
