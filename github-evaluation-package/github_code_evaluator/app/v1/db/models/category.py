import uuid
from sqlalchemy import Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from uuid6 import uuid7

from github_code_evaluator.app.v1.db.base_class import Base


class Category(Base):
    """Category ORM model.

    Stores the standard dimensions (categories) for evaluation along with their weights.
    """

    __tablename__ = "categories"

    # PRIMARY KEY
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid7,
    )

    # FIELDS
    name: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        unique=True,
    )

    weight: Mapped[float] = mapped_column(
        Numeric(3, 2),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
