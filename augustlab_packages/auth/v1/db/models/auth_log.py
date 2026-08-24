"""
Authentication logs model.
"""

import uuid
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import INET

from v1.db.base import Base


class AuthLog(Base):
    """
    SQLAlchemy model for authentication logs.
    """

    __tablename__ = "auth_logs"

    auth_logs_id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id: Mapped[UUID]
    action: Mapped[str] = mapped_column(String(50))
    provider: Mapped[str] = mapped_column(String(50))
    ip_address: Mapped[str | None] = mapped_column(INET)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )
