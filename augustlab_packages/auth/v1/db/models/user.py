"""
User model for authentication - FINAL FIX.

This module contains the User model which extends FastAPI-Users'
SQLAlchemyBaseUserTable to integrate with our custom schema.
"""
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import String, DateTime, ForeignKey, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from fastapi_users_db_sqlalchemy import SQLAlchemyBaseUserTable
from sqlalchemy.dialects.postgresql import UUID
from v1.utils.uuid import generate_uuid7
from v1.core.config import settings
from v1.db.base import Base

if TYPE_CHECKING:
    from v1.db.models.organization import Organization
    from v1.db.models.session import Session
    from v1.db.models.oauth_account import OAuthAccount


# Helper function to get default organization ID
def get_default_org_id() -> uuid.UUID:
    """
    Get default organization ID, handling both UUID and string types from settings.
    """
    if isinstance(settings.DEFAULT_ORGANIZATION_ID, uuid.UUID):
        return settings.DEFAULT_ORGANIZATION_ID
    return uuid.UUID(str(settings.DEFAULT_ORGANIZATION_ID))


class User(SQLAlchemyBaseUserTable[uuid.UUID], Base):
    """
    User model for authentication.
    
    Extends FastAPI-Users SQLAlchemyBaseUserTable which provides:
        - email: User's email address (unique)
        - hashed_password: Bcrypt hashed password
        - is_active: Whether account is active
        - is_superuser: Admin privileges flag
        - is_verified: Email verification status
    
    Custom fields we add:
        - users_name: Full name
        - organization_id: Organization membership (FK)
        - created_at: Creation timestamp
        - updated_at: Last modification timestamp
    
    Database mapping:
        Table: auth.users
        Primary Key: users_id (mapped from 'id')
        Unique: users_email
        Foreign Keys: organization_id -> organizations.organization_id
        Indexes: users_email, organization_id
    
    Relationships:
        - organization: Many users -> One organization
        - sessions: One user -> Many sessions
        - oauth_accounts: One user -> Many OAuth accounts
    """
    
    __tablename__ = "users"
    
    # ========================================
    # PRIMARY KEY - CRITICAL: Must be named 'id' for FastAPI-Users
    # ========================================
    id: Mapped[uuid.UUID] = mapped_column(
        "users_id",          # DB column name
        UUID(as_uuid=True),
        primary_key=True,
        default=generate_uuid7,
    )

    
    # ========================================
    # AUTHENTICATION FIELDS (FastAPI-Users)
    # ========================================
    email: Mapped[str] = mapped_column(
        "users_email",
        String(320),
        unique=True,
        index=True,
        nullable=False,
        comment="User email - unique login identifier",
    )
    
    hashed_password: Mapped[str] = mapped_column(
        "password_hash",
        String(1024),
        nullable=False,
        comment="Bcrypt hashed password - never store plaintext",
    )
    
    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
    )
    
    is_superuser: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )
    
    is_verified: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )
    
    # ========================================
    # CUSTOM FIELDS
    # ========================================
    users_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="User's full name",
    )
    
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "auth.organizations.organization_id",
            ondelete="SET DEFAULT",
        ),
        nullable=False,
        default=get_default_org_id,
        server_default=text(f"'{settings.DEFAULT_ORGANIZATION_ID}'"),
        index=True,
        comment="Organization membership",
    )
    
    # ========================================
    # AUDIT FIELDS
    # ========================================
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        comment="Account creation timestamp",
    )
    
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        onupdate=func.now(),
        comment="Last modification timestamp",
    )
    
    # ========================================
    # RELATIONSHIPS
    # ========================================
    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="users",
        lazy="joined",  # Always load with user
    )
    
    sessions: Mapped[list["Session"]] = relationship(
        "Session",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="noload",
    )
    
    oauth_accounts: Mapped[list["OAuthAccount"]] = relationship(
        "OAuthAccount",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="noload",
    )
    
    def __repr__(self) -> str:
        """
        String representation for debugging.
        """
        return (
            f"<User(id={self.id}, email='{self.email}', "
            f"name='{self.users_name}', org_id={self.organization_id})>"
        )