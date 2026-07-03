import uuid
from datetime import datetime
from sqlalchemy import DateTime, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.v1.db.base_class import Base
from app.v1.utils.uuid import UUIDHelper


class JobPriority(Base):
    """JobPriority ORM model.

    Represents the priority levels (P1, P2, P3) and their default durations.

    Attributes:
        id: The primary key (UUID7).
        name: The name of the priority (e.g., P1, P2, P3).
        duration_days: Default duration in days for this priority.
        created_at: Timestamp when created.
        updated_at: Timestamp when last updated.
    """

    __tablename__ = "job_priorities"

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    # FIELDS
    name: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
    )

    duration_days: Mapped[int] = mapped_column(
        Integer,
        default=30,
        nullable=False,
    )

    associate_reminder_hours: Mapped[int] = mapped_column(
        Integer,
        default=24,
        nullable=False,
    )

    # TIMESTAMPS
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        onupdate=func.now(),
    )
