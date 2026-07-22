import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.v1.db.base_class import Base

if TYPE_CHECKING:
    from app.v1.db.models.files import File
    from app.v1.db.models.jobs import Job


from app.v1.utils.uuid import UUIDHelper


class User(Base):
    """User ORM model.

    Represents a user in the hiring platform with authentication
    and authorization attributes.

    Attributes:
        id: The primary key of the user (UUID7).
        full_name: The full name of the user.
        email: The email address of the user (unique).
        password_hash: The hashed password of the user.
        is_active: Whether the user account is active.
        role_id: Foreign key to the roles table.
        created_at: Timestamp when user was created.
        updated_at: Timestamp when user was last updated.
    """

    __tablename__ = "users"

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    # USER FIELDS
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )

    auth_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        unique=True,
        index=True,
        nullable=True,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    refresh_token: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
    )

    refresh_token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean(),
        default=True,
        nullable=False,
    )

    # FOREIGN KEY
    role_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="SET NULL"),
        nullable=True,
    )

    # TIMESTAMPS
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        onupdate=func.now(),
    )

    # RELATIONSHIPS
    role = relationship("Role", back_populates="users")
    jobs: Mapped[list["Job"]] = relationship("Job", back_populates="creator")
    files: Mapped[list["File"]] = relationship("File", back_populates="owner")

    @property
    def role_name(self) -> str | None:
        return self.role.name if self.role else None
