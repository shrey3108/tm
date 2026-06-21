import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.v1.db.base import Base
from app.v1.db.models.job_tech_stacks import job_tech_stacks
from app.v1.utils.uuid import UUIDHelper

if TYPE_CHECKING:
    from app.v1.db.models.jobs import Job


class TechStack(Base):
    """TechStack ORM model.

    Represents a technology stack (e.g. Python/FastAPI, MERN, React/Frontend)
    that can be assigned to a job.

    Attributes:
        id: The primary key of the tech stack (UUID7).
        name: The unique name of the tech stack (not null).
        description: A short description of the tech stack (optional).
    """

    __tablename__ = "tech_stacks"

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    # FIELDS
    name: Mapped[str] = mapped_column(
        Text,
        unique=True,
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
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
    jobs: Mapped[list["Job"]] = relationship(
        "Job",
        secondary=job_tech_stacks,
        back_populates="tech_stacks",
    )
