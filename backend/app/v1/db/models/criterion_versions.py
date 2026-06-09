import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.v1.db.base_class import Base
from app.v1.utils.uuid import UUIDHelper

if TYPE_CHECKING:
    from app.v1.db.models.criteria import Criterion


class CriterionVersion(Base):
    """CriterionVersion ORM model.

    Represents a historical snapshot of an evaluation criterion.
    A new version is created every time the criterion's name,
    description, or prompt_text is changed.

    Attributes:
        id: The primary key (UUID7).
        criterion_id: FK to the main criteria table.
        version_number: Monotonically increasing version counter (1, 2, ...).
        name: The criterion name at this version.
        description: The criterion description at this version.
        prompt_text: The AI rubric prompt at this version.
        created_at: Timestamp when this version was created.
    """

    __tablename__ = "criterion_versions"

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    # FOREIGN KEY
    criterion_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("criteria.id", ondelete="CASCADE"),
        nullable=False,
    )

    version_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # SNAPSHOT FIELDS
    name: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    prompt_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # TIMESTAMPS
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # RELATIONSHIPS
    criterion: Mapped["Criterion"] = relationship(
        "Criterion", back_populates="versions", foreign_keys=[criterion_id]
    )
