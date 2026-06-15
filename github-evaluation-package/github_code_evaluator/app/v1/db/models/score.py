import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Numeric, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from uuid6 import uuid7

from github_code_evaluator.app.v1.db.base_class import Base

if TYPE_CHECKING:
    from github_code_evaluator.app.v1.db.models.evaluation import Evaluation


class EvaluationScore(Base):
    """EvaluationScore ORM model.

    Tracks score and weight for specific metrics (e.g. correctness, security)
    associated with an evaluation run.
    """

    __tablename__ = "evaluation_scores"

    __table_args__ = (
        UniqueConstraint("evaluation_id", "category", name="uq_evaluation_category_score"),
    )

    # PRIMARY KEY
    evaluation_score_id: Mapped[uuid.UUID] = mapped_column(
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

    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.category_id", ondelete="SET NULL"),
        nullable=True,
    )

    # FIELDS
    category: Mapped[str] = mapped_column(
        Text,
        nullable=False,  # correctness | code_quality | architecture | security | testing | performance | documentation | overall
    )

    score: Mapped[float] = mapped_column(
        Numeric(4, 1),
        nullable=False,
    )

    weight: Mapped[float] = mapped_column(
        Numeric(3, 2),
        nullable=False,
    )

    weighted_score: Mapped[float] = mapped_column(
        Numeric(4, 2),
        nullable=False,
    )

    # RELATIONSHIPS
    evaluation: Mapped["Evaluation"] = relationship(
        "Evaluation",
        back_populates="scores",
    )
