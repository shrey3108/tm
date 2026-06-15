import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from uuid6 import uuid7

from github_code_evaluator.app.v1.db.base_class import Base

if TYPE_CHECKING:
    from github_code_evaluator.app.v1.db.models.repository import Repository
    from github_code_evaluator.app.v1.db.models.score import EvaluationScore
    from github_code_evaluator.app.v1.db.models.report import EvaluationReport


class Evaluation(Base):
    """Evaluation ORM model.

    Tracks a code evaluation run, including its overall status,
    combined score, recommendation, and LLM metadata.
    """

    __tablename__ = "evaluations"

    # PRIMARY KEY
    evaluation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid7,
    )

    # FOREIGN KEYS
    repository_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("repositories.repository_id", ondelete="CASCADE"),
        nullable=False,
    )

    # FIELDS
    status: Mapped[str] = mapped_column(
        Text,
        default="queued",  # queued | processing | complete | failed
        nullable=False,
    )

    overall_score: Mapped[float | None] = mapped_column(
        Numeric(3, 1),
        nullable=True,
    )

    recommendation: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,  # Proceed | Reject
    )

    llm_model: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    prompt_version: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    candidate_email: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    recruiter_email: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    job_title: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    job_position: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    job_description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # TIMESTAMPS
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # RELATIONSHIPS
    repository: Mapped["Repository"] = relationship(
        "Repository",
        back_populates="evaluations",
    )

    scores: Mapped[list["EvaluationScore"]] = relationship(
        "EvaluationScore",
        back_populates="evaluation",
        cascade="all, delete-orphan",
    )

    reports: Mapped[list["EvaluationReport"]] = relationship(
        "EvaluationReport",
        back_populates="evaluation",
        cascade="all, delete-orphan",
    )
