"""
Schemas for authentication audit logs (public fields only).
"""

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class AuthLogRead(BaseModel):
    """
    Public read schema for auth logs (fields visible in Swagger).
    """

    id: UUID
    user_id: UUID
    action: str
    provider: str
    ip_address: str | None
    created_at: datetime

    class Config:
        from_attributes = True
