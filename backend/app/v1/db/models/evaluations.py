import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.v1.db.base_class import Base
from app.v1.utils.uuid import UUIDHelper

if TYPE_CHECKING:
    from app.v1.db.models.interviews import Interview
    from app.v1.db.models.transcripts import Transcript
    from app.v1.db.models.candidate_stages import CandidateStage


class Evaluation(Base):
    """Evaluation ORM model.

    Stores AI agent evaluations and manual HR form evaluation outputs.
    Records strict JSON outputs based on dynamic criteria.
    """

    __tablename__ = "evaluations"

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    # FOREIGN KEYS
    interview_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("interviews.id", ondelete="SET NULL"),
        nullable=True,
    )

    transcript_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transcripts.id", ondelete="SET NULL"),
        nullable=True,
    )

    # THIS TELLS WHICH CANDIDATE STAGE WE ARE EVALUATING (Stage 1, 2, etc.)
    candidate_stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidate_stages.id", ondelete="CASCADE"),
        nullable=False,
    )

    # EVALUATION FIELDS
    evaluation_data: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
    )

    overall_score: Mapped[float | None] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )

    recommendation: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # SIMILARITY SCORES
    sim_jd_resume: Mapped[float | None] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    sim_jd_transcript: Mapped[float | None] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    sim_resume_transcript: Mapped[float | None] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    evidence_block: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    # TIMESTAMPS
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # RELATIONSHIPS
    interview: Mapped[Optional["Interview"]] = relationship("Interview", foreign_keys=[interview_id])
    transcript: Mapped[Optional["Transcript"]] = relationship("Transcript", foreign_keys=[transcript_id])
    candidate_stage: Mapped["CandidateStage"] = relationship("CandidateStage", foreign_keys=[candidate_stage_id])
