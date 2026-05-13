import uuid
from sqlalchemy import Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.v1.db.base_class import Base
from app.v1.utils.uuid import UUIDHelper

class SystemSetting(Base):
    """System-wide configuration settings stored in the database."""
    __tablename__ = "system_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    key: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        unique=True,
        index=True,
        comment="The setting key (e.g. 'transcript_default_dir')"
    )

    value: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="The setting value as a string"
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Optional explanation of what this setting does"
    )
