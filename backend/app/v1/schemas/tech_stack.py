"""
Pydantic schemas for Tech Stack-related data transfer.
"""

import uuid
from pydantic import BaseModel, ConfigDict


class TechStackBase(BaseModel):
    """
    Base schema for TechStack data with shared attributes.
    """

    name: str
    description: str | None = None


class TechStackCreate(TechStackBase):
    """
    Schema for creating a new TechStack.
    """

    pass


class TechStackUpdate(BaseModel):
    """
    Schema for updating an existing TechStack.
    """

    name: str | None = None
    description: str | None = None


class TechStackRead(TechStackBase):
    """
    Schema for reading TechStack data, including database-generated fields.
    """

    id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)
