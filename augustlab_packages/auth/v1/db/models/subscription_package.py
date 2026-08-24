"""
Subscription package model.
"""
from datetime import datetime
from uuid import UUID
from typing import TYPE_CHECKING

from sqlalchemy import String, DateTime, Text, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from v1.db.base import Base
from v1.utils.uuid import generate_uuid7

if TYPE_CHECKING:
    from v1.db.models.organization import Organization


class SubscriptionPackage(Base):
    __tablename__ = "subscription_packages"

    subscription_packages_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=generate_uuid7,
    )

    subscription_packages_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    max_members: Mapped[int | None] = mapped_column(
        nullable=True,
        comment="NULL = unlimited",
    )

    subscription_packages_features: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # Relationships
    organizations: Mapped[list["Organization"]] = relationship(
        "Organization",
        back_populates="subscription_package",
        lazy="noload",
    )

    __table_args__ = (
        {"schema": Base.__table_args__["schema"]},
    )

    def __repr__(self) -> str:
        return f"<SubscriptionPackage(id={self.subscription_packages_id}, name='{self.subscription_packages_name}')>"
