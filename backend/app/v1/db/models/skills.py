import uuid
from typing import TYPE_CHECKING

from pgvector.sqlalchemy import Vector
from sqlalchemy import Text, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.v1.core.config import settings
from app.v1.db.base import Base
from app.v1.db.models.job_skills import job_skills
from app.v1.utils.uuid import UUIDHelper

if TYPE_CHECKING:
    from app.v1.db.models.jobs import Job


class Skill(Base):
    """Skill ORM model.

    Represents a skill in the hiring platform.

    Attributes:
        id: The primary key of the skill (UUID7).
        name: The unique name of the skill (not null).
        description: A short description of the skill (optional).
        skill_embedding: Vector embedding of name + description.
        default_weightage: The default weightage given to this skill, nullable.
    """

    __tablename__ = "skills"

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    # SKILL FIELDS
    name: Mapped[str] = mapped_column(
        Text,
        unique=True,
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # VECTOR EMBEDDING (name + description combined)
    skill_embedding: Mapped[list | None] = mapped_column(
        Vector(settings.EMBEDDING_VECTOR_DIM),
        nullable=True,
    )

    default_weightage: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        default=10.0,
    )

    jobs: Mapped[list["Job"]] = relationship(
        "Job",
        secondary=job_skills,
        back_populates="skills",
    )
