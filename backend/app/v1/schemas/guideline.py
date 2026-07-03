"""
Pydantic schemas for Guideline-related data transfer.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class GuidelineBase(BaseModel):
    """
    Base schema for Guideline data with shared attributes.
    """
    content: str
    is_default: bool = False


class GuidelineCreate(GuidelineBase):
    """
    Schema for creating a new Guideline.
    """
    pass


class GuidelineUpdate(BaseModel):
    """
    Schema for updating an existing Guideline.
    """
    content: str | None = None
    is_default: bool | None = None


class GuidelineRead(GuidelineBase):
    """
    Schema for reading Guideline data, including database-generated fields.
    """
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
