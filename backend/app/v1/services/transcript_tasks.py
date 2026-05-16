import uuid
import asyncio
import hashlib
import os
import logging
from app.v1.core.celery_app import celery_app
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.v1.db.session import async_session_maker
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.files import File as DBFile
from app.v1.db.models.interviews import Interview
from app.v1.db.models.transcript_chunks import TranscriptChunk
from app.v1.db.models.transcripts import Transcript
from app.v1.db.models.user import User
from app.v1.utils.transcript_parser import process_transcript_file, chunk_dialogues
from app.v1.core.embeddings import EmbeddingService
from app.v1.services.evaluation_tasks import evaluate_candidate_transcript_task
from app.v1.core.storage import resolve_storage_path

logger = logging.getLogger(__name__)

@celery_app.task(name="process_transcript_task")
def process_transcript_task(candidate_stage_id_str: str, file_infos: list[dict]):
    """
    Celery task to process one or more uploaded transcript files.
    1. Reads each file from disk.
    2. Parses dialogues from each file.
    3. Merges all dialogues into a single sequence.
    4. Saves to database as a single Transcript.
    5. Triggers the AI evaluation task.
    """
    candidate_stage_id = uuid.UUID(candidate_stage_id_str)

    # Async loop setup for Celery
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    async def run_processing():
        async with async_session_maker() as db:
            try:
                # 0. Fetch Context
                current_stage = await db.get(
                    CandidateStage, 
                    candidate_stage_id, 
                    options=[selectinload(CandidateStage.job_stage)]
                )
                if not current_stage:
                    logger.error(f"Candidate stage {candidate_stage_id} not found")
                    return

                candidate_id = current_stage.candidate_id
                
                # Fetch first user as owner
                first_user_result = await db.execute(select(User).limit(1))
                first_user = first_user_result.scalar_one_or_none()
                if not first_user:
                    logger.error("No users found to assign as file owner")
                    return

                all_dialogues = []
                primary_file_id = None
                
                # 1. Process each file
                for idx, info in enumerate(file_infos):
                    file_path_str = info["path"]
                    original_filename = info["filename"]
                    
                    file_path = resolve_storage_path(file_path_str)
                    ext = os.path.splitext(original_filename)[1].lower()

                    if not file_path.exists():
                        logger.error(f"File not found: {file_path}")
                        continue
                    
                    with open(file_path, "rb") as f:
                        content = f.read()

                    # 2. Parse
                    processed_data = process_transcript_file(content, ext)
                    all_dialogues.extend(processed_data.get("dialogues", []))

                    # 3. Save File entry
                    db_file = DBFile(
                        owner_id=first_user.id,
                        candidate_id=candidate_id,
                        file_name=original_filename,
                        file_type=ext.replace('.', ''),
                        size=len(content),
                        source_url=file_path_str
                    )
                    db.add(db_file)
                    await db.flush()
                    
                    # Track the first file as the primary one for the Transcript
                    if idx == 0:
                        primary_file_id = db_file.id

                if not all_dialogues:
                    logger.error("No dialogues extracted from any of the provided files.")
                    return

                # 4. Merge and finalize
                # Reconstruct clean text from merged dialogues
                clean_text = "\n\n".join([d["text"] for d in all_dialogues])
                
                # Hash for duplicates
                import time
                salt_text = clean_text + f"\n\n[Merge Salt: {time.time()}]"
                transcript_hash = hashlib.sha256(salt_text.encode('utf-8')).hexdigest()

                # 5. DB Insertions
                # a. Interview session (Reuse existing if it matches candidate, job, and stage)
                interview_stmt = select(Interview).where(
                    Interview.candidate_id == candidate_id,
                    Interview.job_id == current_stage.job_stage.job_id,
                    Interview.stage == current_stage.job_stage.stage_order
                ).limit(1)
                existing_interview_res = await db.execute(interview_stmt)
                interview = existing_interview_res.scalar_one_or_none()

                if not interview:
                    interview = Interview(
                        candidate_id=candidate_id,
                        job_id=current_stage.job_stage.job_id,
                        interviewer_id=first_user.id,
                        stage=current_stage.job_stage.stage_order,
                        status="completed"
                    )
                    db.add(interview)
                
                await db.flush()

                # b. Transcript
                transcript = Transcript(
                    interview_id=interview.id,
                    file_id=primary_file_id,
                    clean_transcript_text=clean_text,
                    transcript_hash=transcript_hash,
                    segments={"dialogues": all_dialogues}
                )
                db.add(transcript)
                await db.flush()

                # c. Embeddings & Chunks
                embedding_service = EmbeddingService()
                chunks_text = chunk_dialogues(all_dialogues, chunk_size_turns=10, overlap_turns=2)
                db_chunks = []
                
                for idx, chunk_text in enumerate(chunks_text):
                    vector = embedding_service.encode_transcript(chunk_text)
                    chunk_record = TranscriptChunk(
                        transcript_id=transcript.id,
                        chunk_index=idx,
                        text_content=chunk_text,
                        embedding=vector
                    )
                    db_chunks.append(chunk_record)
                    
                db.add_all(db_chunks)
                
                # 6. Commit
                await db.commit()
                logger.info(f"Successfully processed merged transcript for stage {candidate_stage_id} with {len(file_infos)} files.")

                # 7. Trigger AI Evaluation
                evaluate_candidate_transcript_task.delay(str(candidate_stage_id))

            except Exception as e:
                logger.error(f"Transcript processing failed: {e}")
                await db.rollback()
                raise

    return loop.run_until_complete(run_processing())
