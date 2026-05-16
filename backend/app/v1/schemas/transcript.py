"""
Pydantic schemas for transcript upload and retrieval.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class DialogueTurn(BaseModel):
    """A single speaker turn in the transcript."""

    speaker: str
    timestamp: str
    text: str


class TranscriptMetadata(BaseModel):
    """Extracted metadata from the transcript document."""

    candidate_name: str = ""
    interviewer_name: str = ""
    interview_date: str = ""
    duration: str = ""
    position: str = ""


class TranscriptUploadResponse(BaseModel):
    """Returned immediately after a .docx transcript is uploaded."""

    recording_id: uuid.UUID
    transcript_id: uuid.UUID
    interview_id: uuid.UUID
    status: str  # "processing"
    message: str


class TranscriptStatusResponse(BaseModel):
    """Full transcript result once processing is complete."""

    transcript_id: uuid.UUID
    recording_id: uuid.UUID
    interview_id: uuid.UUID
    status: str  # "processing" | "completed" | "failed"
    metadata: TranscriptMetadata | None = None
    dialogue_count: int = 0
    dialogues: list[DialogueTurn] = []
    clean_text: str | None = None
    generated_at: datetime | None = None
    error: str | None = None


class TranscriptUpdate(BaseModel):
    """Payload for updating an existing transcript."""

    transcript_text: str



class TranscriptPathUpdate(BaseModel):
    """Payload for updating system settings like default path."""
    path: str = Field(..., description="The new system path")
