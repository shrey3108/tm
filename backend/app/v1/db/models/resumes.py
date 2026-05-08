import uuid
from datetime import datetime

from typing import TYPE_CHECKING

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.v1.core.config import settings
from app.v1.db.base import Base

if TYPE_CHECKING:
    from app.v1.db.models.candidates import Candidate
    from app.v1.db.models.files import File


from app.v1.utils.uuid import UUIDHelper


class Resume(Base):
    """Resume ORM model.

    Represents a parsed resume linked to a candidate and a file.

    Attributes:
        id: The primary key (UUID7).
        candidate_id: FK to the candidate this resume belongs to.
        file_id: FK to the file record where the resume is stored.
        uploaded_at: Timestamp when resume was uploaded.
        parsed: Whether the resume has been parsed by AI/LLM.
        parse_summary: Flexible JSONB extracted from the resume.
        resume_score: AI score between 0 and 100.
        pass_fail: Whether the candidate passed or failed screening.
        pass_threshold: The threshold used for pass/fail (default 0.65).
    """

    __tablename__ = "resumes"

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )
    resume_embedding: Mapped[list | None] = mapped_column(
        Vector(settings.EMBEDDING_VECTOR_DIM),
        nullable=True,
    )

    # FOREIGN KEYS
    candidate_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id"),
        nullable=True,
    )

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("files.id"),
        nullable=False,
    )

    # TIMESTAMPS
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # AI / PARSING FIELDS
    parsed: Mapped[bool] = mapped_column(
        Boolean(),
        default=False,
        nullable=False,
    )

    parse_summary: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    resume_score: Mapped[float | None] = mapped_column(
        Numeric,
        nullable=True,
    )

    pass_fail: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    pass_threshold: Mapped[float] = mapped_column(
        Numeric,
        default=0.65,
        nullable=False,
    )

    text_hash: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        index=True,
        comment="SHA-256 hex digest of extracted resume text for content-level deduplication",
    )

    # RELATIONSHIPS
    candidate: Mapped["Candidate | None"] = relationship(
        "Candidate", back_populates="resumes", foreign_keys=[candidate_id]
    )
    file: Mapped["File"] = relationship("File", foreign_keys=[file_id])
    version_results: Mapped[list["ResumeVersionResult"]] = relationship(
        "ResumeVersionResult", back_populates="resume", cascade="all, delete-orphan", order_by="desc(ResumeVersionResult.job_version_number)"
    )

