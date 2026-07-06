import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Text, Numeric, Index, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.v1.core.config import settings
from app.v1.db.base import Base

if TYPE_CHECKING:
    from app.v1.db.models.candidates import Candidate
    from app.v1.db.models.departments import Department
    from app.v1.db.models.job_chunks import JobChunk
    from app.v1.db.models.job_stage_configs import JobStageConfig
    from app.v1.db.models.job_versions import JobVersion
    from app.v1.db.models.skills import Skill
    from app.v1.db.models.user import User
    from app.v1.db.models.job_priorities import JobPriority
    from app.v1.db.models.job_positions import JobPosition
    from app.v1.db.models.associates import Associate
from app.v1.db.models.job_skills import job_skills
from app.v1.db.models.job_associates import job_associates
from app.v1.utils.uuid import UUIDHelper


class Job(Base):
    """Job ORM model.

    Represents a job posting in the hiring platform.

    Attributes:
        id: The primary key of the job (UUID7).
        title: The title of the job (not null).
        department_id: FK to the departments table (optional).
        department: Relationship to the Department entity.
        jd_text: The job description as plain text (optional).
        jd_json: The job description as structured JSON (optional).
        jd_embedding: Combined vector embedding of title + department + jd_text + jd_json.
        created_by: FK to the user who created this job.
        created_at: Timestamp when job was created.
        is_active: Whether the job posting is active.
    """

    __tablename__ = "jobs"
    __table_args__ = (
        # Partial unique index: only one ACTIVE job allowed per (title, position_id).
        # Inactive jobs with the same (title, position_id) are allowed, so a new
        # active job can be created even if older inactive ones exist with the same combo.
        Index(
            "uq_jobs_title_position_active",
            "title",
            "position_id",
            unique=True,
            postgresql_where=text("is_active = true"),
        ),
    )

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    # JOB FIELDS
    title: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    vacancy: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    # DEPARTMENT FK (replaces plain text department column)
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
    )

    jd_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    jd_json: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    # VECTOR EMBEDDING (title + department + jd_text + jd_json combined)
    jd_embedding: Mapped[list | None] = mapped_column(
        Vector(settings.EMBEDDING_VECTOR_DIM),
        nullable=True,
    )

    # FOREIGN KEY
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # TIMESTAMPS
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # STATUS
    is_active: Mapped[bool] = mapped_column(
        Boolean(),
        default=True,
        nullable=False,
    )

    passing_threshold: Mapped[float] = mapped_column(
        Numeric(10, 2),
        default=70.0,
        nullable=False,
    )

    question_bank_passing_threshold: Mapped[float] = mapped_column(
        Numeric(10, 2),
        default=70.0,
        nullable=False,
    )

    # CUSTOM EXTRACTION
    custom_extraction_fields: Mapped[list[str] | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    task_file_path: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    task_skills: Mapped[list[str] | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    send_ai_evaluation_to_associate: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
    )

    version: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )

    processing_version: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    # PRIORITY FIELDS
    priority_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("job_priorities.id", ondelete="SET NULL"),
        nullable=True,
    )

    position_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("job_positions.id", ondelete="RESTRICT"),
        nullable=False,
    )

    priority_start_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    priority_end_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    associate_reminder_hours: Mapped[int] = mapped_column(
        Integer,
        default=24,
        nullable=False,
    )

    # RELATIONSHIPS
    creator: Mapped["User"] = relationship(
        "User", back_populates="jobs", foreign_keys=[created_by]
    )
    candidates: Mapped[list["Candidate"]] = relationship(
        "Candidate", back_populates="applied_job", cascade="save-update, merge, refresh-expire"
    )
    versions: Mapped[list["JobVersion"]] = relationship(
        "JobVersion",
        back_populates="job",
        order_by="JobVersion.version_number",
        cascade="all, delete-orphan",
    )
    skills: Mapped[list["Skill"]] = relationship(
        "Skill",
        secondary=job_skills,
        back_populates="jobs",
    )
    associates: Mapped[list["Associate"]] = relationship(
        "Associate",
        secondary=job_associates,
        back_populates="jobs",
    )

    stages: Mapped[list["JobStageConfig"]] = relationship(
        "JobStageConfig",
        back_populates="job",
        order_by="JobStageConfig.stage_order",
        cascade="all, delete-orphan",
    )
    chunks: Mapped[list["JobChunk"]] = relationship(
        "JobChunk",
        back_populates="job",
        cascade="all, delete-orphan",
    )
    department: Mapped[Optional["Department"]] = relationship(
        "Department",
        back_populates="jobs",
        foreign_keys=[department_id],
        lazy="joined",
    )
    priority: Mapped[Optional["JobPriority"]] = relationship(
        "JobPriority",
        foreign_keys=[priority_id],
        lazy="joined",
    )
    position: Mapped[Optional["JobPosition"]] = relationship(
        "JobPosition",
        foreign_keys=[position_id],
        lazy="joined",
    )

    @property
    def department_name(self) -> str | None:
        """Return the department name for convenience (used in serialisation)."""
        return self.department.name if self.department else None

    @property
    def total_versions(self) -> int:
        """Return the total number of versions for this job."""
        return len(self.versions)

    @property
    def job_versions(self) -> list[dict]:
        """Return a list of version objects with version_num and id."""
        return [
            {"version_num": v.version_number, "id": v.id} 
            for v in self.versions
        ]


