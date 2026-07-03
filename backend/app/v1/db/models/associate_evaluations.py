"""
AssociateEvaluation ORM model.

Tracks each associate's evaluation assignment and submission for a candidate stage.
Created when HR sends a test paper to an associate via the send-to-associates endpoint.
Updated when the associate submits marks via the token-based review form.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.v1.db.base_class import Base
from app.v1.utils.uuid import UUIDHelper

if TYPE_CHECKING:
    from app.v1.db.models.candidate_stages import CandidateStage
    from app.v1.db.models.associates import Associate
    from app.v1.db.models.candidate_test_paper import CandidateTestPaper
    from app.v1.db.models.candidates import Candidate
    from app.v1.db.models.jobs import Job


class AssociateEvaluation(Base):
    """AssociateEvaluation ORM model.

    Represents an evaluation assignment sent to an associate for a candidate stage.
    The associate accesses the review form via a unique token (no auth required).

    Attributes:
        id: Primary key (UUID7).
        candidate_stage_id: FK to the candidate stage.
        associate_id: FK to the associate.
        test_paper_id: FK to the candidate test paper sent.
        candidate_id: FK to the candidate.
        job_id: FK to the job.
        review_token: Unique token for form access (no auth).
        sent_at: When the email was sent to the associate.
        submitted_at: When the associate submitted marks (null if pending).
        status: "sent" or "submitted".
        marks: JSONB list of {question_text, max_marks, awarded_marks}.
        total_marks: Sum of awarded marks.
        max_total_marks: Sum of max marks.
        result: "pass" / "fail" / null.
    """

    __tablename__ = "associate_evaluations"

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    # FOREIGN KEYS
    candidate_stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidate_stages.id", ondelete="CASCADE"),
        nullable=False,
    )

    associate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("associates.id", ondelete="CASCADE"),
        nullable=False,
    )

    test_paper_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidate_test_papers.id", ondelete="CASCADE"),
        nullable=False,
    )

    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id", ondelete="CASCADE"),
        nullable=False,
    )

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
    )

    # FIELDS
    review_token: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        unique=True,
        nullable=False,
        default=UUIDHelper.generate_uuid7,
    )

    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    submitted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        Text,
        default="sent",
        nullable=False,
    )

    last_reminder_sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    marks: Mapped[Optional[list[dict]]] = mapped_column(
        JSONB,
        nullable=True,
    )

    total_marks: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )

    max_total_marks: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )

    result: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    # RELATIONSHIPS
    candidate_stage: Mapped["CandidateStage"] = relationship(
        "CandidateStage", foreign_keys=[candidate_stage_id]
    )

    associate: Mapped["Associate"] = relationship(
        "Associate", foreign_keys=[associate_id]
    )

    test_paper: Mapped["CandidateTestPaper"] = relationship(
        "CandidateTestPaper", foreign_keys=[test_paper_id]
    )

    candidate: Mapped["Candidate"] = relationship(
        "Candidate", foreign_keys=[candidate_id]
    )

    job: Mapped["Job"] = relationship(
        "Job", foreign_keys=[job_id]
    )
