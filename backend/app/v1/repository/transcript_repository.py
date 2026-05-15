"""
Data access layer for transcript operations.
Matches the actual Transcript model which has interview_id and file_id directly.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.models.transcripts import Transcript
from app.v1.db.models.files import File as FileRecord


class TranscriptRepository:

    async def create_file_record(
        self,
        db: AsyncSession,
        *,
        owner_id: uuid.UUID,
        candidate_id: uuid.UUID,
        file_name: str,
        file_type: str,
        source_url: str,
        size: int,
    ) -> FileRecord:
        file_record = FileRecord(
            owner_id=owner_id,
            candidate_id=candidate_id,
            file_name=file_name,
            file_type=file_type,
            source_url=source_url,
            size=size,
        )
        db.add(file_record)
        await db.flush()
        return file_record

    async def create_transcript(
        self,
        db: AsyncSession,
        *,
        interview_id: uuid.UUID,
        file_id: uuid.UUID,
        transcript_text: str | None = None,
        segments: dict | None = None,
    ) -> Transcript:
        transcript = Transcript(
            interview_id=interview_id,
            file_id=file_id,
            transcript_text=transcript_text,
            segments=segments,
        )
        db.add(transcript)
        await db.flush()
        return transcript

    async def update_transcript(
        self,
        db: AsyncSession,
        *,
        transcript_id: uuid.UUID,
        transcript_text: str,
        segments: dict,
    ) -> None:
        await db.execute(
            update(Transcript)
            .where(Transcript.id == transcript_id)
            .values(
                transcript_text=transcript_text,
                segments=segments,
            )
        )

    async def get_transcript(
        self,
        db: AsyncSession,
        *,
        transcript_id: uuid.UUID,
    ) -> Transcript | None:
        return await db.scalar(
            select(Transcript).where(Transcript.id == transcript_id)
        )

    async def get_transcripts_for_interview(
        self,
        db: AsyncSession,
        *,
        interview_id: uuid.UUID,
    ) -> list[Transcript]:
        return list(
            (
                await db.scalars(
                    select(Transcript)
                    .where(Transcript.interview_id == interview_id)
                    .order_by(Transcript.generated_at.desc())
                )
            ).all()
        )

    async def commit(self, db: AsyncSession) -> None:
        await db.commit()

    async def rollback(self, db: AsyncSession) -> None:
        await db.rollback()


transcript_repository = TranscriptRepository()
