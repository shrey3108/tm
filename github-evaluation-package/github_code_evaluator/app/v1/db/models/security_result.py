import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from uuid6 import uuid7

from github_code_evaluator.app.v1.db.base_class import Base

if TYPE_CHECKING:
    from github_code_evaluator.app.v1.db.models.evaluation import Evaluation


class SecurityResult(Base):
    """SecurityResult ORM model.

    Stores security scan finding entries from tools like bandit, semgrep, and secrets detection.
    """

    __tablename__ = "security_results"

    __table_args__ = (
        UniqueConstraint("evaluation_id", "tool", name="uq_evaluation_tool_security"),
    )

    # PRIMARY KEY
    security_result_id: Mapped[uuid.UUID] = mapped_column(
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
    tool: Mapped[str] = mapped_column(
        Text,
        nullable=False,  # bandit | semgrep | gitleaks
    )

    findings: Mapped[list | dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    critical_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    # TIMESTAMPS
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # RELATIONSHIPS
    evaluation: Mapped["Evaluation"] = relationship(
        "Evaluation",
        # We can back_populates if we add relationship to Evaluation
    )
