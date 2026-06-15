import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from uuid6 import uuid7

from github_code_evaluator.app.v1.db.base_class import Base

if TYPE_CHECKING:
    from github_code_evaluator.app.v1.db.models.evaluation import Evaluation


class Repository(Base):
    """Repository ORM model.

    Tracks a submitted GitHub repository, including its metadata,
    clone status, and detected stack.
    """

    __tablename__ = "repositories"

    # PRIMARY KEY
    repository_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid7,
    )

    github_url: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    cloned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    stack: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    jd_skills: Mapped[list[str] | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    project_required_skills: Mapped[list[str] | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    # TIMESTAMPS
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # RELATIONSHIPS
    evaluations: Mapped[list["Evaluation"]] = relationship(
        "Evaluation",
        back_populates="repository",
        cascade="all, delete-orphan",
    )
