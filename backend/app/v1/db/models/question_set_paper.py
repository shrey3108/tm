import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.v1.db.base_class import Base
from app.v1.utils.uuid import UUIDHelper

if TYPE_CHECKING:
    from app.v1.db.models.jobs import Job
    from app.v1.db.models.job_positions import JobPosition


class QuestionSetPaper(Base):
    """QuestionSetPaper ORM model.

    Represents a predefined pool of 5 questions and a project task
    associated with a specific Job and JobPosition (experience level).
    """

    __tablename__ = "question_set_papers"

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    # FIELDS
    name: Mapped[str] = mapped_column(
        Text,
        nullable=False,
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

    questions: Mapped[list[str]] = mapped_column(
        JSONB,
        nullable=False,
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
    job: Mapped["Job"] = relationship(
        "Job", foreign_keys=[job_id]
    )

    position: Mapped["JobPosition"] = relationship(
        "JobPosition", foreign_keys=[position_id]
    )
