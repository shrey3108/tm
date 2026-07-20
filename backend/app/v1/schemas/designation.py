import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class DesignationBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=50, description="Designation name")

class DesignationCreate(DesignationBase):
    pass

class DesignationRead(DesignationBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
