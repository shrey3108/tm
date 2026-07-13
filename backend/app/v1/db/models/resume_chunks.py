import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.v1.core.config import settings
from app.v1.db.base_class import Base


from app.v1.utils.uuid import UUIDHelper


class ResumeChunk(Base):
    """ResumeChunk ORM model.

    Represents a parsed chunk of a resume.
    Stores structured JSON and raw text along with a combined embedding.

    Attributes:
        id: The primary key (UUID7).
        resume_id: FK to the resume this chunk belongs to.
        parsed_at: Timestamp when the resume was parsed.
        parsed_json: Structured parsed content (EM).
        raw_text: Raw fallback text content (EM).
        chunk_embedding: Vector embedding of parsed_json + raw_text combined.
    """

    __tablename__ = "resume_chunks"

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    # FOREIGN KEYS
    resume_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resumes.id", ondelete="CASCADE"),
        nullable=False,
    )

    # TIMESTAMPS
    parsed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # PARSED FIELDS (EM)
    parsed_json: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    raw_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # VECTOR EMBEDDING (parsed_json + raw_text combined)
    chunk_embedding: Mapped[list | None] = mapped_column(
        Vector(settings.EMBEDDING_VECTOR_DIM),
        nullable=True,
    )

    # RELATIONSHIPS
    resume = relationship("Resume", foreign_keys=[resume_id])
