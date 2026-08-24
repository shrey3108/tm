"""
Organization model for multi-tenancy with UUID7 support.
"""
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import String, DateTime, ForeignKey, func, Index
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from v1.db.base import Base
from v1.utils.uuid import generate_uuid7

if TYPE_CHECKING:
    from v1.db.models.user import User
    from v1.db.models.subscription_package import SubscriptionPackage
    from v1.db.models.organization_settings import OrganizationSettings


class Organization(Base):
    __tablename__ = "organizations"

    organization_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=generate_uuid7,
        comment="Primary key - UUID7",
    )

    organization_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    current_location: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    subscription_packages_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            f"{Base.__table_args__['schema']}.subscription_packages.subscription_packages_id"
        ),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        onupdate=func.now(),
    )

    # -------------------------
    # Relationships
    # -------------------------
    users: Mapped[list["User"]] = relationship(
        "User",
        back_populates="organization",
        lazy="noload",
    )

    subscription_package: Mapped["SubscriptionPackage | None"] = relationship(
        "SubscriptionPackage",
        back_populates="organizations",
        lazy="joined",
    )

    settings: Mapped["OrganizationSettings | None"] = relationship(
        "OrganizationSettings",
        back_populates="organization",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="joined",
    )

    __table_args__ = (
        Index("idx_org_created_at", "created_at"),
        {"schema": Base.__table_args__["schema"]},
    )

    def __repr__(self) -> str:
        return f"<Organization(id={self.organization_id}, name='{self.organization_name}')>"
