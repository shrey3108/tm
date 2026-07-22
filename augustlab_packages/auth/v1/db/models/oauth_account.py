"""
OAuth accounts model for Google and Zoho authentication.
"""
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from v1.db.base import Base
from v1.utils.uuid import generate_uuid7
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from v1.db.models.user import User


class OAuthAccount(Base):
    """
    OAuth account model for external authentication providers.
    
    Links users to their OAuth accounts (Google, Zoho, etc.)
    """
    
    __tablename__ = "oauth_accounts"
    
    oauth_accounts_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=generate_uuid7,
        comment="Primary key - unique OAuth account identifier",
    )
    
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.users_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="User this OAuth account belongs to",
    )
    
    provider_name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="OAuth provider (google, zoho, etc.)",
    )
    
    current_location: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="User location from OAuth provider",
    )
    
    access_token: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="OAuth access token",
    )
    
    refresh_token: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="OAuth refresh token",
    )
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        comment="OAuth account creation timestamp",
    )
    
    # Relationship
    user: Mapped["User"] = relationship(
        "User",
        back_populates="oauth_accounts",
    )
    
    def __repr__(self) -> str:
        return (
            f"<OAuthAccount(id={self.oauth_accounts_id}, "
            f"user_id={self.user_id}, provider={self.provider_name})>"
        )