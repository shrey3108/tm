import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.v1.db.base_class import Base
from app.v1.utils.uuid import UUIDHelper

if TYPE_CHECKING:
    from app.v1.db.models.transcripts import Transcript


class TranscriptChunk(Base):
    """TranscriptChunk ORM model.

    Stores smaller chunks of the parsed and cleaned interview transcript.
    Used for vector embeddings, RAG operations, and reranker context modeling.
    """

    __tablename__ = "transcript_chunks"

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    # FOREIGN KEYS
    transcript_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transcripts.id", ondelete="CASCADE"),
        nullable=False,
    )

    # CHUNK META
    chunk_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    text_content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # Using JSONB for embeddings array, ready to be migrated to pgvector type if needed.
    embedding: Mapped[list[float] | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    # TIMESTAMPS
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # RELATIONSHIPS
    transcript: Mapped["Transcript"] = relationship("Transcript", foreign_keys=[transcript_id])
