import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.v1.db.base_class import Base
from app.v1.utils.uuid import UUIDHelper

if TYPE_CHECKING:
    from app.v1.db.models.criteria import Criterion
    from app.v1.db.models.stage_templates import StageTemplate


class StageTemplateCriterion(Base):
    """StageTemplateCriterion ORM model.

    Mapping table linking criteria to stage templates, defining default weights
    and whether the criterion is active for a given template.
    """

    __tablename__ = "stage_template_criteria"

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    # FOREIGN KEYS
    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("stage_templates.id", ondelete="CASCADE"),
        nullable=False,
    )

    criterion_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("criteria.id", ondelete="CASCADE"),
        nullable=False,
    )

    # FIELDS
    is_active: Mapped[bool] = mapped_column(
        Boolean(),
        default=True,
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    default_weight: Mapped[float] = mapped_column(
        Numeric(5, 2),
        default=0.0,
        nullable=False,
    )

    # TIMESTAMPS
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True,
    )

    # RELATIONSHIPS
    template: Mapped["StageTemplate"] = relationship("StageTemplate", foreign_keys=[template_id])
    criterion: Mapped["Criterion"] = relationship("Criterion", foreign_keys=[criterion_id])
