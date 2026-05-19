"""
Interview ORM model.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.v1.db.base_class import Base
from app.v1.utils.uuid import UUIDHelper


class Interview(Base):
    """Interview ORM model.

    Represents an interview session for a candidate for a specific job.

    Attributes:
        id: The primary key (UUID7).
        candidate_id: FK to the candidate being interviewed.
        job_id: FK to the job/position being interviewed for.
        interviewer_id: FK to the user conducting the interview.
        stage: Interview round number (1=HR screening, 2=Technical, 3=Panel, 4=CTO).
        status: Current status — 'pending', 'completed', 'failed', 'cancelled'.
        created_at: Timestamp when interview was created.
    """

    __tablename__ = "interviews"

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    # FOREIGN KEYS
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id"),
        nullable=False,
    )

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id"),
        nullable=False,
    )

    interviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    # STAGE: 1=HR screening, 2=Technical, 3=Panel, 4=CTO
    stage: Mapped[int] = mapped_column(
        nullable=False,
        default=1,
    )

    # STATUS: 'pending', 'completed', 'failed', 'cancelled'
    status: Mapped[str] = mapped_column(
        Text,
        default="pending",
        nullable=False,
    )

    # TIMESTAMPS
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # RELATIONSHIPS
    candidate = relationship("Candidate", foreign_keys=[candidate_id])
    job = relationship("Job", foreign_keys=[job_id])
    interviewer = relationship("User", foreign_keys=[interviewer_id])
