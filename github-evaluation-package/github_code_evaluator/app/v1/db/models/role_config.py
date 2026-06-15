import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from uuid6 import uuid7

from github_code_evaluator.app.v1.db.base_class import Base


class RoleWeightConfig(Base):
    """RoleWeightConfig ORM model.

    Stores and versions category weights for different job roles/titles.
    """

    __tablename__ = "role_weight_configs"

    # PRIMARY KEY
    role_weight_config_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid7,
    )

    # FIELDS
    role_name: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        unique=True,
    )

    weights: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
    )

    default_skills: Mapped[list[str] | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    version: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )

    # TIMESTAMPS
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
