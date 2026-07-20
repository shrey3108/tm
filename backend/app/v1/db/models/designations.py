import uuid
from datetime import datetime
from sqlalchemy import Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.v1.db.base_class import Base
from app.v1.utils.uuid import UUIDHelper

class Designation(Base):
    """Designation ORM model.
    Represents an associate designation (e.g., HR, CTO, DEV).
    """
    __tablename__ = "designations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )
    name: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        unique=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    associates = relationship(
        "Associate",
        back_populates="designation",
        cascade="all, delete-orphan",
    )
