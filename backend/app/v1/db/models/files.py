import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.v1.db.base_class import Base
from app.v1.utils.uuid import UUIDHelper

if TYPE_CHECKING:
    from app.v1.db.models.candidates import Candidate
    from app.v1.db.models.user import User


class File(Base):
    """File ORM model.

    Represents an uploaded file (resume, cover letter, transcript, etc.)
    associated with a candidate in the hiring platform.

    Attributes:
        id: The primary key (UUID7).
        owner_id: FK to the user who uploaded the file.
        candidate_id: FK to the candidate this file belongs to.
        file_name: Original name of the file.
        file_type: Type/format of the file (e.g., pdf, docx).
        source_url: External URL if the file is hosted externally.
        size: Size of the file in bytes.
        created_at: Timestamp when file was uploaded.
    """

    __tablename__ = "files"

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    # FOREIGN KEYS
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    candidate_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id"),
        nullable=True,
    )

    # FILE FIELDS
    file_name: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    file_type: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    source_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    size: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    content_hash: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        index=True,
        comment="SHA-256 hex digest of the raw file bytes for duplicate-upload detection",
    )

    # TIMESTAMPS
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # RELATIONSHIPS
    owner: Mapped["User"] = relationship(
        "User", back_populates="files", foreign_keys=[owner_id]
    )
    candidate: Mapped["Candidate | None"] = relationship(
        "Candidate", back_populates="files", foreign_keys=[candidate_id]
    )

    @property
    def uploader_name(self) -> str | None:
        return self.owner.full_name if self.owner else None

    @property
    def candidate_name(self) -> str | None:
        if not self.candidate:
            return None
        names = [n for n in [self.candidate.first_name, self.candidate.last_name] if n]
        return " ".join(names) if names else "Unknown Candidate"
