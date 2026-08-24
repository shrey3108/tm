"""
Session model for tracking user sessions and refresh tokens.
"""
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from v1.db.base import Base
from v1.utils.uuid import generate_uuid7
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from v1.db.models.user import User


class Session(Base):
    """
    Session model for tracking user sessions and refresh tokens.
    """
    __tablename__ = "sessions"
    
    sessions_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=generate_uuid7,
    )
    
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.users_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    access_token: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
        comment="JWT access token (optional - for tracking)",
    )
    
    refresh_token: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
        unique=True,  # ✅ Add unique constraint
        index=True,    # ✅ Add index for fast lookups
        comment="Refresh token (long-lived)",
    )
    
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        comment="Session expiration timestamp",
    )
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        comment="Session creation timestamp",
    )
    
    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
        comment="Client IP address",
    )
    
    user_agent: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
        comment="User agent string",
    )
    
    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
        comment="Whether session is still active",
    )
    
    # Relationship
    user: Mapped["User"] = relationship(
        "User",
        back_populates="sessions",
    )
    
    def __repr__(self) -> str:
        return (
            f"<Session(id={self.sessions_id}, user_id={self.user_id}, "
            f"expires_at={self.expires_at})>"
        )