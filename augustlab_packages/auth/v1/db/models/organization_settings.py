"""
Organization-specific authentication settings.
"""
from datetime import datetime
from uuid import UUID
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from v1.db.base import Base
from v1.utils.uuid import generate_uuid7

if TYPE_CHECKING:
    from v1.db.models.organization import Organization


class OrganizationSettings(Base):
    __tablename__ = "organization_settings"

    organization_settings_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=generate_uuid7,
    )

    organization_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            f"{Base.__table_args__['schema']}.organizations.organization_id",
            ondelete="CASCADE",
        ),
        nullable=False,
        unique=True,
    )

    custom_login: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default="false",
    )

    enable_google: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default="false",
    )

    enable_zoho: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default="false",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # Relationship
    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="settings",
    )

    __table_args__ = (
        {"schema": Base.__table_args__["schema"]},
    )

    def __repr__(self) -> str:
        return f"<OrganizationSettings(org_id={self.organization_id})>"
