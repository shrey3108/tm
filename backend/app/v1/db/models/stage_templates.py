import uuid
from datetime import datetime

from sqlalchemy import DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.v1.db.base_class import Base


from app.v1.utils.uuid import UUIDHelper


class StageTemplate(Base):
    """StageTemplate ORM model.

    Represents a reusable hiring stage template
    (e.g., HR Screening Round, Technical Practical Round).

    Attributes:
        id: The primary key (UUID7).
        name: Name of the stage template (not null).
        description: Info regarding this stage (optional).
        default_config: Default config JSON for this stage.
        created_at: Timestamp when template was created.
    """

    __tablename__ = "stage_templates"

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
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    default_config: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    is_default: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
        server_default="false",
    )

    default_order: Mapped[int | None] = mapped_column(
        nullable=True,
    )

    # TIMESTAMPS
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    @property
    def config(self) -> dict | None:
        """Alias for default_config to match API schema naming."""
        return self.default_config

    @config.setter
    def config(self, value: dict | None):
        """Setter for the config alias."""
        self.default_config = value
