import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.v1.db.base_class import Base
from app.v1.utils.uuid import UUIDHelper

if TYPE_CHECKING:
    from app.v1.db.models.candidates import Candidate
    from app.v1.db.models.job_stage_configs import JobStageConfig
    from app.v1.db.models.user import User


class CandidateStage(Base):
    """CandidateStage ORM model.

    Tracks a candidate's journey through a specific job's candidate pipeline.
    Represents a single instance of a hiring stage for a particular candidate.

    Attributes:
        id: Primary key (UUID7).
        candidate_id: FK to the candidate.
        job_stage_id: FK to the specific job stage configuration.
        status: Current status in this stage ('pending', 'active', 'completed', 'failed', 'skipped').
        evaluation_data: JSON results, scores, or feedback for this stage.
        interviewer_id: FK to the user assigned to this stage evaluation.
        started_at: When the candidate entered this stage.
        completed_at: When the candidate finished this stage.
    """

    __tablename__ = "candidate_stages"
    __table_args__ = (
        UniqueConstraint("candidate_id", "job_stage_id", name="uq_cand_stage"),
    )

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    # FOREIGN KEYS
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id", ondelete="CASCADE"),
        nullable=False,
    )

    job_stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("job_stage_configs.id", ondelete="CASCADE"),
        nullable=False,
    )

    interviewer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # FIELDS
    status: Mapped[str] = mapped_column(
        Text,
        default="pending",
        nullable=False,
    )

    evaluation_data: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    # TIMESTAMPS
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=True,
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # RELATIONSHIPS
    candidate: Mapped["Candidate"] = relationship(
        "Candidate", back_populates="stages", foreign_keys=[candidate_id]
    )
    job_stage: Mapped["JobStageConfig"] = relationship(
        "JobStageConfig", back_populates="candidate_stages", foreign_keys=[job_stage_id]
    )
    interviewer: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[interviewer_id]
    )
