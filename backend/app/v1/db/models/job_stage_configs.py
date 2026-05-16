import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.v1.db.base_class import Base
from app.v1.utils.uuid import UUIDHelper

if TYPE_CHECKING:
    from app.v1.db.models.jobs import Job
    from app.v1.db.models.stage_templates import StageTemplate
    from app.v1.db.models.candidate_stages import CandidateStage


class JobStageConfig(Base):
    """JobStageConfig ORM model.

    Represents the configuration of a hiring stage for a specific job.
    Allows fully flexible, per-job stage configuration.

    Attributes:
        id: The primary key (UUID7).
        job_id: FK to the job this stage belongs to.
        stage_order: Order/sequence of this stage in the pipeline.
        template_id: FK to the stage template to apply.
        config: Flexible JSON config for this stage instance.
        is_mandatory: Whether this stage is required for this job.
        created_at: Timestamp when config was created.
    """

    __tablename__ = "job_stage_configs"

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    # FOREIGN KEYS
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
    )

    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("stage_templates.id"),
        nullable=False,
    )

    # FIELDS
    stage_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    config: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    is_mandatory: Mapped[bool] = mapped_column(
        Boolean(),
        default=True,
        nullable=False,
    )

    is_default: Mapped[bool] = mapped_column(
        Boolean(),
        default=False,
        nullable=False,
    )

    # TIMESTAMPS
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # RELATIONSHIPS
    job: Mapped["Job"] = relationship(
        "Job", back_populates="stages", foreign_keys=[job_id]
    )
    template: Mapped["StageTemplate"] = relationship(
        "StageTemplate", foreign_keys=[template_id]
    )
    candidate_stages: Mapped[list["CandidateStage"]] = relationship(
        "CandidateStage", back_populates="job_stage", cascade="all, delete-orphan"
    )
