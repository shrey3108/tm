import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.v1.db.base_class import Base
from app.v1.utils.uuid import UUIDHelper

if TYPE_CHECKING:
    from app.v1.db.models.criterion_versions import CriterionVersion


class Criterion(Base):
    """Criterion ORM model.

    Master list of evaluation criteria (e.g., Communication, Confidence,
    Tech Stack, Cultural Fit).
    """

    __tablename__ = "criteria"

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
        unique=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # The AI-generated or manually adjusted LLM instruction prompt for this specific criterion
    # e.g. "Evaluate the candidate's communication skills. Consider: - Clarity... Scoring rubric: 1-5"
    prompt_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Current version number — incremented on each meaningful edit
    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )

    # TIMESTAMPS
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # RELATIONSHIPS
    versions: Mapped[list["CriterionVersion"]] = relationship(
        "CriterionVersion",
        back_populates="criterion",
        cascade="all, delete-orphan",
        order_by="desc(CriterionVersion.version_number)",
        lazy="selectin",
    )

    @property
    def total_versions(self) -> int:
        """Return the total number of versions for this criterion."""
        return len(self.versions)

    @property
    def criterion_versions(self) -> list[dict]:
        """Return a list of version objects with version_num and id."""
        return [
            {"version_num": v.version_number, "id": v.id}
            for v in self.versions
        ]
