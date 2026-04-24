import uuid
from datetime import datetime

from sqlalchemy import DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.v1.db.base_class import Base
from app.v1.utils.uuid import UUIDHelper


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

    # TIMESTAMPS
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
