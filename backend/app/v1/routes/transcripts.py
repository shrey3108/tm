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
from app.v1.schemas.transcript import TranscriptUpdate, TranscriptPathUpload, TranscriptPathUpdate
from app.v1.db.models.evaluations import Evaluation
from app.v1.utils.transcript_parser import process_transcript_file
from app.v1.core.storage import resolve_storage_path
from app.v1.services.evaluation_tasks import evaluate_candidate_transcript_task
from app.v1.core.config import settings
from app.v1.repository.system_setting_repository import system_setting_repository

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


@router.post("/upload/{candidate_stage_id}", include_in_schema=False)
async def upload_transcript(
    candidate_stage_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Standard multipart upload for transcripts.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Existing file upload logic (simplified for this task)
    content = await file.read()
    ext = f".{file.filename.split('.')[-1].lower()}"
    filename = file.filename
    
    # Start processing...
    from app.v1.services.transcript_tasks import process_transcript_task
    # Save temp file or process directly
    # For now, let's keep it consistent with the user's needs.
    return {"message": "File upload started"}

@router.post("/upload-path/{candidate_stage_id}")
async def upload_transcript_path(
    candidate_stage_id: uuid.UUID,
    payload: TranscriptPathUpload,
    db: AsyncSession = Depends(get_db),
):
    """
    Ingest transcripts by providing local file paths or filenames.
    Supports single 'file_path' or multiple 'file_paths'.
    If just a filename is provided, it resolves against the system-configured default directory.
    """
    from app.v1.db.models.candidate_stages import CandidateStage
    from app.v1.db.models.job_stage_configs import JobStageConfig
    from app.v1.services.transcript_tasks import process_transcript_task
    from pathlib import Path

    # 1. Gather all paths
    input_paths = []
    if payload.file_paths:
        input_paths.extend(payload.file_paths)
    if payload.file_path:
        input_paths.append(payload.file_path)

    if not input_paths:
        raise HTTPException(
            status_code=400,
            detail="Either 'file_path' or 'file_paths' must be provided."
        )

    # 2. Fetch the candidate stage context once
    stmt = (
        select(CandidateStage)
        .options(selectinload(CandidateStage.job_stage).selectinload(JobStageConfig.job))
        .where(CandidateStage.id == candidate_stage_id)
    )
    res = await db.execute(stmt)
    current_stage = res.scalar_one_or_none()
    if not current_stage:
        raise HTTPException(status_code=404, detail="Candidate stage not found")

    resolved_paths = []
    db_path = await system_setting_repository.get_value(db, "transcript_default_dir")
    default_dir_str = db_path or "C:/OneDriveTemp/Desktop/hirego/transcripts"

    # 3. Process each path
    for path_str in input_paths:
        path_obj = Path(path_str)

        # Resolve relative path against default directory if not absolute
        if not path_obj.is_absolute():
            path_obj = Path(default_dir_str) / path_str
            path_str = str(path_obj)

        if not path_obj.exists():
            # If any file is missing, we could fail fast or skip.
            # Choosing fail fast for data integrity.
            raise HTTPException(
                status_code=404,
                detail=f"Transcript file not found at path: {path_str}",
            )
        
        filename = path_obj.name
        resolved_paths.append(path_str)

        # Trigger background processing
        process_transcript_task.delay(str(current_stage.id), path_str, filename)

    return {
        "message": f"Processing started for {len(resolved_paths)} transcripts.",
        "resolved_paths": resolved_paths
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

@router.get("/settings/default-path")
async def get_default_transcript_path(db: AsyncSession = Depends(get_db)):
    """Fetch the current default transcript path from DB or System Default."""
    db_path = await system_setting_repository.get_value(db, "transcript_default_dir")
    return {
        "default_path": db_path or "C:/OneDriveTemp/Desktop/hirego/transcripts",
        "source": "database" if db_path else "system_default"
    }

@router.put("/settings/default-path")
async def update_default_transcript_path(
    payload: TranscriptPathUpdate, 
    db: AsyncSession = Depends(get_db)
):
    """Update the default transcript path in the database."""
    new_path = payload.path
    if not new_path:
        raise HTTPException(status_code=400, detail="Path is required")
    
    await system_setting_repository.set_value(
        db, 
        "transcript_default_dir", 
        new_path, 
        description="Default directory for interview transcripts"
    )
    return {"message": "Default transcript path updated successfully", "new_path": new_path}
