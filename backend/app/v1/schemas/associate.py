"""
Pydantic schemas for Associate-related data transfer.
"""

import uuid

from pydantic import BaseModel, ConfigDict, EmailStr


class AssociateBase(BaseModel):
    """
    Base schema for Associate data with shared attributes.
    """

    name: str
    email: EmailStr


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


class AssociateRead(AssociateBase):
    """
    Schema for reading Associate data, including database-generated fields.
    """

    id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)
