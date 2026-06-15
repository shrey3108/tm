import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from uuid6 import uuid7

from github_code_evaluator.app.v1.db.base_class import Base


class ReviewerOverrideLog(Base):
    """ReviewerOverrideLog ORM model.

    Maintains audit logs of manual category score changes made by reviewers.
    """

    __tablename__ = "reviewer_override_logs"

    # PRIMARY KEY
    override_log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid7,
    )

    # FOREIGN KEYS
    evaluation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("evaluations.evaluation_id", ondelete="CASCADE"),
        nullable=False,
    )

    # FIELDS
    category: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    old_score: Mapped[float] = mapped_column(
        Numeric(4, 1),
        nullable=False,
    )

    new_score: Mapped[float] = mapped_column(
        Numeric(4, 1),
        nullable=False,
    )

    notes: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    reviewer_username: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # TIMESTAMPS
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
