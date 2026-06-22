import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.v1.db.base_class import Base
from app.v1.db.models.question_set_paper_skills import question_set_paper_skills
from app.v1.utils.uuid import UUIDHelper

if TYPE_CHECKING:
    from app.v1.db.models.job_positions import JobPosition
    from app.v1.db.models.departments import Department
    from app.v1.db.models.skills import Skill


class QuestionSetPaper(Base):
    """QuestionSetPaper ORM model.

    Represents a predefined pool of questions and a project task
    associated with a specific Department, TechStack, and JobPosition (experience level).
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

    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
    )



    position_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("job_positions.id", ondelete="CASCADE"),
        nullable=False,
    )

    paper_type: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="normal",
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
    department: Mapped["Department"] = relationship(
        "Department", foreign_keys=[department_id]
    )

    skills: Mapped[list["Skill"]] = relationship(
        "Skill",
        secondary=question_set_paper_skills,
        lazy="selectin",
    )

    position: Mapped["JobPosition"] = relationship(
        "JobPosition", foreign_keys=[position_id]
    )
