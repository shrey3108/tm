import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from uuid6 import uuid7

from github_code_evaluator.app.v1.db.base_class import Base


class PromptEvaluation(Base):
    """PromptEvaluation ORM model.

    Stores system prompt templates for LiteLLM evaluator versioning.
    """

    __tablename__ = "prompt_evaluation"

    # PRIMARY KEY
    prompt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid7,
    )

    # FIELDS
    version: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        unique=True,
    )

    prompt_template: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    updated_by: Mapped[str] = mapped_column(
        Text,
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


# Compatibility alias
EvaluationPrompt = PromptEvaluation
