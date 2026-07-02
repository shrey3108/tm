import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.v1.db.base_class import Base
from app.v1.utils.uuid import UUIDHelper

if TYPE_CHECKING:
    from app.v1.db.models.candidates import Candidate
    from app.v1.db.models.jobs import Job
    from app.v1.db.models.job_positions import JobPosition
    from app.v1.db.models.job_stage_configs import JobStageConfig
    from app.v1.db.models.guidelines import Guideline


class CandidateTestPaper(Base):
    """CandidateTestPaper ORM model.

    Represents the actual instance of the test paper assigned
    to a candidate for their evaluation.
    """

    __tablename__ = "candidate_test_papers"

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    candidate_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id", ondelete="CASCADE"),
        nullable=True,
    )

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
    )

    position_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("job_positions.id", ondelete="CASCADE"),
        nullable=False,
    )

    job_stage_config_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("job_stage_configs.id", ondelete="CASCADE"),
        nullable=True,
    )

    name: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    questions: Mapped[list[str]] = mapped_column(
        JSONB,
        nullable=False,
    )

    mcqs: Mapped[list[dict]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
    )

    project_task: Mapped[list[str]] = mapped_column(
        JSONB,
        nullable=False,
    )

    task_file_path: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    task_skills: Mapped[list[str] | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    email_sent_count: Mapped[int] = mapped_column(
        default=0,
        server_default="0",
        nullable=False,
    )

    guideline_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("guidelines.id", ondelete="SET NULL"),
        nullable=True,
    )

    guideline_content: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    # TIMESTAMPS
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # RELATIONSHIPS
    candidate: Mapped["Candidate"] = relationship(
        "Candidate", back_populates="test_paper", foreign_keys=[candidate_id]
    )

    job: Mapped["Job"] = relationship(
        "Job", foreign_keys=[job_id]
    )

    position: Mapped["JobPosition"] = relationship(
        "JobPosition", foreign_keys=[position_id]
    )

    job_stage: Mapped["JobStageConfig"] = relationship(
        "JobStageConfig", foreign_keys=[job_stage_config_id]
    )

    guideline: Mapped[Optional["Guideline"]] = relationship(
        "Guideline", foreign_keys=[guideline_id]
    )
