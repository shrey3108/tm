import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from typing import TYPE_CHECKING
from app.v1.db.base_class import Base
from app.v1.utils.uuid import UUIDHelper

if TYPE_CHECKING:
    from app.v1.db.models.candidates import Candidate
    from app.v1.db.models.job_stage_configs import JobStageConfig
    from app.v1.db.models.users import User


class HrDecision(Base):
    """HrDecision ORM model.

    Represents an HR decision made on a candidate for a specific hiring stage.

    Attributes:
        id: The primary key (UUID7).
        candidate_id: FK to the candidate being evaluated.
        stage_config_id: FK to the job stage this decision belongs to.
        user_id: FK to the user making the decision.
        decision: The decision value — 'pass', 'fail', or 'May Be'.
        decided_at: Timestamp when the decision was made.
    """

    __tablename__ = "hr_decisions"

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

    stage_config_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("job_stage_configs.id"),
        nullable=True,
    )

    job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=True,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    # DECISION FIELD: 'pass', 'fail', 'May Be'
    decision: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # DECISION NOTES
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # DECISION SCORE OUT OF 5
    score: Mapped[int | None] = mapped_column(
        nullable=True,
    )

    # TIMESTAMPS
    decided_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # RELATIONSHIPS
    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="hr_decisions", foreign_keys=[candidate_id])
    stage_config: Mapped["JobStageConfig"] = relationship("JobStageConfig", foreign_keys=[stage_config_id])
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])

    @property
    def stage_name(self) -> str:
        """Returns the human-readable name of the stage this decision belongs to."""
        if self.stage_config and self.stage_config.template:
            return self.stage_config.template.name
        
        # If no stage_config_id, it's the initial Resume Screening phase
        return "Resume Screening"
