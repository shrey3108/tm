import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Numeric, Text, Integer
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.v1.core.config import settings
from app.v1.db.base import Base
from app.v1.db.models.candidate_skills import candidate_skills
from app.v1.utils.uuid import UUIDHelper

if TYPE_CHECKING:
    from app.v1.db.models.files import File
    from app.v1.db.models.jobs import Job
    from app.v1.db.models.locations import Location
    from app.v1.db.models.resumes import Resume
    from app.v1.db.models.hr_decisions import HrDecision
    from app.v1.db.models.candidate_stages import CandidateStage
    from app.v1.db.models.skills import Skill


class Candidate(Base):
    """Candidate ORM model.

    Represents a candidate in the hiring platform.

    Attributes:
        id: The primary key of the candidate (UUID7).
        first_name: First name of the candidate (may be input by HR).
        last_name: Last name of the candidate (may be input by HR).
        email: Email of the candidate (may be input by HR).
        phone: Phone number of the candidate (may be input by HR).
        applied_job_id: FK to the job the candidate applied for.
        info: Extracted candidate info from resume (JSONB).
        info_embedding: Vector embedding of candidate info.
        rrf_score: Reciprocal Rank Fusion score for ranking.
        current_status: Current status in hiring pipeline.
        created_at: Timestamp when candidate was created.
    """

    __tablename__ = "candidates"

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    # CANDIDATE FIELDS (may be input by HR)
    first_name: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    last_name: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    email: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        index=True,
    )

    phone: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # LOCATION FK (replaces plain text location column)
    location_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("locations.id", ondelete="SET NULL"),
        nullable=True,
    )

    # FOREIGN KEY
    applied_job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="SET NULL"),
        nullable=True,
    )

    applied_version_number: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    # RESUME / AI FIELDS
    info: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    info_embedding: Mapped[list | None] = mapped_column(
        Vector(settings.EMBEDDING_VECTOR_DIM),
        nullable=True,
    )

    # SCORING & STATUS
    rrf_score: Mapped[float | None] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    current_status: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # TIMESTAMPS
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # RELATIONSHIPS
    applied_job: Mapped["Job"] = relationship(
        "Job", back_populates="candidates", foreign_keys=[applied_job_id]
    )
    location_rel: Mapped[Optional["Location"]] = relationship(
        "Location",
        back_populates="candidates",
        foreign_keys=[location_id],
        lazy="joined",
    )
    resumes: Mapped[list["Resume"]] = relationship("Resume", back_populates="candidate", cascade="all, delete-orphan")
    files: Mapped[list["File"]] = relationship("File", back_populates="candidate", cascade="all, delete-orphan")
    hr_decisions: Mapped[list["HrDecision"]] = relationship("HrDecision", back_populates="candidate", cascade="all, delete-orphan")
    stages: Mapped[list["CandidateStage"]] = relationship("CandidateStage", back_populates="candidate", cascade="all, delete-orphan")
    skills: Mapped[list["Skill"]] = relationship("Skill", secondary=candidate_skills)

    @property
    def location_name(self) -> str | None:
        """Return the location name for convenience (used in serialisation)."""
        return self.location_rel.name if self.location_rel else None
