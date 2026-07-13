import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.v1.db.base_class import Base
from app.v1.utils.uuid import UUIDHelper


class AuditLog(Base):
    """AuditLog ORM model.

    Represents an audit trail entry tracking user actions across the platform.

    Attributes:
        id: The primary key (UUID7).
        user_id: FK to the user who performed the action.
        action: The action performed (not null).
        target_type: Type of the target entity (e.g., 'candidate', 'job').
        target_id: UUID of the target entity.
        details: Additional details about the action in JSONB.
        created_at: Timestamp when the action occurred.
    """

    __tablename__ = "audit_logs"

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    # FOREIGN KEY
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ACTION FIELDS
    action: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    target_type: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    target_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    details: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    # TIMESTAMPS
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # RELATIONSHIPS
    user = relationship("User", foreign_keys=[user_id])

    @property
    def user_name(self) -> str | None:
        return self.user.full_name if self.user else None
