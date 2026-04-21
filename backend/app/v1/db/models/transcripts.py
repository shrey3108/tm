import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.v1.db.base_class import Base


from app.v1.utils.uuid import UUIDHelper


class Transcript(Base):
    """Transcript ORM model.

    Represents a transcript from an interview session, uploaded as a file.

    Attributes:
        id: The primary key (UUID7).
        interview_id: FK to the interview session this transcript belongs to.
        file_id: FK to the file record where the transcript text/json is stored.
        transcript_text: Full plain text of the transcript.
        segments: Structured JSONB segments with speaker and timing info.
        generated_at: Timestamp when transcript was added.
    """

    __tablename__ = "transcripts"

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    # FOREIGN KEYS
    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("interviews.id"),
        nullable=False,
    )

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("files.id"),
        nullable=False,
    )

    # TRANSCRIPT FIELDS
    transcript_hash: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        index=True,
        unique=True,
        comment="SHA-256 hash of the parsed clean transcript text to avoid duplicate evaluation processing",
    )

    clean_transcript_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    transcript_embeddings: Mapped[list[float] | None] = mapped_column(
        JSONB, # We can use pgvector/vector later, storing as JSONB array for now
        nullable=True,
    )


    # TIMESTAMPS
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # RELATIONSHIPS
    interview = relationship("Interview", foreign_keys=[interview_id])
    file = relationship("File", foreign_keys=[file_id])
