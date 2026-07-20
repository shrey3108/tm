"""
Pydantic schemas for Associate-related data transfer.
"""

import uuid

from pydantic import BaseModel, ConfigDict, EmailStr
from app.v1.schemas.designation import DesignationRead


class AssociateBase(BaseModel):
    """
    Base schema for Associate data with shared attributes.
    """

    name: str
    email: EmailStr
    designation_id: uuid.UUID


class AssociateCreate(AssociateBase):
    """
    Schema for creating a new Associate.
    """

    pass


class AssociateUpdate(BaseModel):
    """
    Schema for updating an existing Associate.
    """

    name: str | None = None
    email: EmailStr | None = None
    designation_id: uuid.UUID | None = None


class AssociateRead(AssociateBase):
    """
    Schema for reading Associate data, including database-generated fields.
    """

    id: uuid.UUID
    designation: DesignationRead | None = None

    model_config = ConfigDict(from_attributes=True)
