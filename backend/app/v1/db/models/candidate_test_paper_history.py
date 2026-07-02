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
    from app.v1.db.models.user import User
    from app.v1.db.models.job_stage_configs import JobStageConfig
    from app.v1.db.models.guidelines import Guideline


class CandidateTestPaperHistory(Base):
    """CandidateTestPaperHistory ORM model.

    Logs every test paper assignment or email sent to a candidate,
    preserving the exact questions, tasks, files, and skills at that moment.
    """

    __tablename__ = "candidate_test_paper_histories"

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
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

    task_file_path: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    task_skills: Mapped[Optional[list[str]]] = mapped_column(
        JSONB,
        nullable=True,
    )

    # TIMESTAMPS
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
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

    # RELATIONSHIPS
    candidate: Mapped["Candidate"] = relationship(
        "Candidate", foreign_keys=[candidate_id]
    )

    job: Mapped["Job"] = relationship(
        "Job", foreign_keys=[job_id]
    )

    user: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[user_id]
    )

    guideline: Mapped[Optional["Guideline"]] = relationship(
        "Guideline", foreign_keys=[guideline_id]
    )
