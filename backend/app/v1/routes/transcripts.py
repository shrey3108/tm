import hashlib
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.session import get_db
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.files import File as DBFile
from app.v1.db.models.interviews import Interview
from app.v1.db.models.transcript_chunks import TranscriptChunk
from app.v1.db.models.transcripts import Transcript
from app.v1.schemas.transcript import TranscriptUpdate, TranscriptPathUpload
from app.v1.db.models.evaluations import Evaluation
from app.v1.utils.transcript_parser import process_transcript_file
from app.v1.core.storage import resolve_storage_path
from app.v1.services.evaluation_tasks import evaluate_candidate_transcript_task

router = APIRouter(prefix="/transcripts", tags=["transcripts"])

@router.put("/{transcript_id}")
async def update_transcript(
    transcript_id: uuid.UUID,
    transcript_in: TranscriptUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Update an existing transcript's text and trigger a new AI evaluation.
    This creates a new version (attempt) in the evaluation history.
    """
    # 1. Fetch existing transcript
    transcript = await db.get(Transcript, transcript_id)
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")

    # 2. Update text
    # We update clean_transcript_text as it's used for AI analysis
    transcript.clean_transcript_text = transcript_in.transcript_text
    
    # Update hash to reflect changes
    salt_text = transcript_in.transcript_text + f"\n\n[Edit Salt: {uuid.uuid4()}]"
    transcript.transcript_hash = hashlib.sha256(salt_text.encode('utf-8')).hexdigest()
    
    await db.flush()

    # 3. Find associated CandidateStage to trigger evaluation
    # Evaluation table links transcripts to stages.
    eval_stmt = select(Evaluation.candidate_stage_id).where(Evaluation.transcript_id == transcript_id).limit(1)
    eval_res = await db.execute(eval_stmt)
    candidate_stage_id = eval_res.scalar_one_or_none()
    
    if candidate_stage_id:
        # Trigger AI Evaluation Task
        # evaluation_service automatically handles versioning (attempt_number)
        evaluate_candidate_transcript_task.delay(str(candidate_stage_id))
        
        await db.commit()
        return {
            "message": "Transcript updated. New AI evaluation version has been triggered.",
            "candidate_stage_id": candidate_stage_id
        }
    
    await db.commit()
    return {"message": "Transcript updated, but no evaluation was found to re-trigger."}


@router.post("/upload/{candidate_stage_id}")
async def upload_transcript(
    candidate_stage_id: uuid.UUID,
    payload: TranscriptPathUpload,
    db: AsyncSession = Depends(get_db),
):
    """
    Process an interview transcript from a local file path (.docx, .pdf, .txt).
    
    Takes the candidate_stage_id and the local file_path, validates the path,
    and triggers asynchronous processing.
    """
    file_path_str = payload.file_path
    
    # 1. Validate File Path and Extension
    import os
    from pathlib import Path
    
    path_obj = Path(file_path_str)
    if not path_obj.exists():
        raise HTTPException(status_code=400, detail=f"File path does not exist: {file_path_str}")
    
    if not path_obj.is_file():
        raise HTTPException(status_code=400, detail=f"Path is not a file: {file_path_str}")

    filename = path_obj.name
    ext = path_obj.suffix.lower()
        
    if ext not in {".docx", ".pdf", ".txt"}:
        raise HTTPException(status_code=400, detail="Only .docx, .pdf, and .txt files are allowed for transcripts.")

    # 2. Fetch the CandidateStage directly
    current_stage = await db.get(CandidateStage, candidate_stage_id, options=[selectinload(CandidateStage.job_stage)])
    if not current_stage:
        raise HTTPException(status_code=404, detail="Candidate stage not found")

    # 3. Update Candidate Stage Status to Processing
    current_stage.status = "processing"
    await db.commit()
    
    # 4. Trigger Celery Task for Asynchronous Processing
    from app.v1.services.transcript_tasks import process_transcript_task
    print(f"DEBUG: Triggering Transcript Processing task for path: {file_path_str}")
    try:
        # We pass the absolute path directly. process_transcript_task uses resolve_storage_path 
        # which handles absolute paths correctly.
        task = process_transcript_task.delay(str(current_stage.id), file_path_str, filename)
        print(f"DEBUG: Task successfully sent to Redis. Task ID: {task.id}")
    except Exception as celery_err:
        print(f"ERROR: Failed to send task to Celery: {celery_err}")
        raise HTTPException(status_code=500, detail="Failed to trigger processing task.")

    return {
        "message": "Transcript path received successfully. Processing has started in the background.",
        "candidate_stage_id": current_stage.id,
        "file_path": file_path_str,
        "next_step": "Transcript parsing and AI Evaluation are running in the background."
    }



@router.get("/{transcript_id}")
async def get_transcript(
    transcript_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve a specific transcript by its ID."""
    transcript = await db.get(Transcript, transcript_id)
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    return transcript

@router.get("/candidate/{candidate_id}")
async def get_candidate_transcript(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve the transcript(s) for a specific candidate."""
    query = (
        select(Transcript)
        .join(Interview, Transcript.interview_id == Interview.id)
        .where(Interview.candidate_id == candidate_id)
    )
    result = await db.execute(query)
    transcripts = result.scalars().all()
    return transcripts

@router.post("/test-cleaning")
async def test_transcript_cleaning(
    file: UploadFile = File(...),
):
    """
    Debug endpoint to test transcript cleaning logic without database persistence.
    Returns the cleaned text and dialogues.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    ext = ""
    if "." in file.filename:
        ext = f".{file.filename.split('.')[-1].lower()}"
        
    if ext not in {".docx", ".pdf", ".txt"}:
        raise HTTPException(status_code=400, detail="Only .docx, .pdf, and .txt files are allowed.")

    content = await file.read()
    try:
        processed_data = process_transcript_file(content, ext)
        return {
            "filename": file.filename,
            "raw_clean_text": processed_data["raw_clean_text"],
            "dialogue_count": processed_data["dialogue_count"],
            "dialogues": processed_data["dialogues"],
            "chunks": processed_data["chunks"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleaning failed: {str(e)}")

@router.delete("/{transcript_id}")
async def delete_transcript(
    transcript_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a transcript and all its related AI evaluation data.
    Prevents deletion if the candidate has already been approved.
    """
    from app.v1.db.models.hr_decisions import HrDecision
    
    # 1. Fetch transcript with interview
    query = select(Transcript).options(selectinload(Transcript.interview)).where(Transcript.id == transcript_id)
    result = await db.execute(query)
    transcript = result.scalar_one_or_none()
    
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
        
    interview = transcript.interview
    if not interview:
        raise HTTPException(status_code=404, detail="Associated interview not found")
        
    # 2. Find candidate stage to check stage-specific approval
    eval_query = select(Evaluation.candidate_stage_id).where(Evaluation.transcript_id == transcript.id).limit(1)
    eval_result = await db.execute(eval_query)
    candidate_stage_id = eval_result.scalar_one_or_none()
    
    if candidate_stage_id:
        stage = await db.get(CandidateStage, candidate_stage_id)
        if stage:
            # Check if this specific stage is approved
            decision_query = (
                select(HrDecision)
                .where(
                    HrDecision.candidate_id == interview.candidate_id,
                    HrDecision.stage_config_id == stage.job_stage_id,
                    HrDecision.decision.in_(["approve", "proceed", "approved"])
                )
                .limit(1)
            )
            decision_result = await db.execute(decision_query)
            if decision_result.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Cannot delete transcript because the candidate is already approved for this stage.")
    
    
    # 4. Delete related records
    # Delete Evaluation
    await db.execute(delete(Evaluation).where(Evaluation.transcript_id == transcript.id))
    # Delete Chunks
    await db.execute(delete(TranscriptChunk).where(TranscriptChunk.transcript_id == transcript.id))
    # Delete Transcript
    await db.delete(transcript)
    # Delete Interview
    await db.delete(interview)
    
    # Delete associated file
    if transcript.file_id:
        await db.execute(delete(DBFile).where(DBFile.id == transcript.file_id))
        
    # 5. Reset candidate stage status if found
    if candidate_stage_id:
        stage = await db.get(CandidateStage, candidate_stage_id)
        if stage:
            stage.status = "pending"
            
    await db.commit()
    
    return {"message": "Transcript and related evaluation data deleted successfully."}
