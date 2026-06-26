import hashlib
import uuid
from typing import Any, List, Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.session import get_db
from app.v1.dependencies import check_permission
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.files import File as DBFile
from app.v1.db.models.interviews import Interview
from app.v1.db.models.transcript_chunks import TranscriptChunk
from app.v1.db.models.transcripts import Transcript
from app.v1.schemas.transcript import TranscriptUpdate, TranscriptPathUpdate
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
    from app.v1.utils.uuid import UUIDHelper
    salt_text = transcript_in.transcript_text + f"\n\n[Edit Salt: {UUIDHelper.generate_uuid7()}]"
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




from app.v1.utils.stage import get_stage_required_inputs


@router.post("/upload-path/{candidate_stage_id}")
async def upload_transcript_path(
    candidate_stage_id: uuid.UUID,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(check_permission("candidates:access")),
):
    """
    Upload one or more transcript files (docx, pdf, txt) for a specific candidate stage.
    If multiple files are uploaded, they are merged into a single transcript.
    """
    from app.v1.services.transcript_tasks import process_transcript_task
    
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    # 1. Fetch the candidate stage context once to verify it exists
    stmt = (
        select(CandidateStage)
        .where(CandidateStage.id == candidate_stage_id)
    )
    res = await db.execute(stmt)
    current_stage = res.scalar_one_or_none()
    if not current_stage:
        raise HTTPException(status_code=404, detail="Candidate stage not found")

    # Validate that the stage requires a transcript input
    await db.refresh(current_stage, ["job_stage"])
    if current_stage.job_stage:
        await db.refresh(current_stage.job_stage, ["template"])
        config = current_stage.job_stage.config or {}
        if not config and current_stage.job_stage.template:
            config = current_stage.job_stage.template.default_config or {}
        
        template_name = current_stage.job_stage.template.name if current_stage.job_stage.template else None
        required_inputs = get_stage_required_inputs(config, template_name)
        if "transcript" not in required_inputs:
            raise HTTPException(
                status_code=400,
                detail=f"This stage is not configured for Transcript upload (required inputs: {required_inputs})."
            )


    # 2. Ensure upload directory exists
    upload_dir = resolve_storage_path(settings.TRANSCRIPT_UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_infos = []

    # 3. Save each file
    for f in files:
        if not f.filename:
            continue
            
        # Create a unique filename to avoid collisions
        from app.v1.utils.uuid import UUIDHelper
        unique_filename = f"{UUIDHelper.generate_uuid7()}_{f.filename}"
        file_path = upload_dir / unique_filename
        
        content = await f.read()
        with open(file_path, "wb") as wb_file:
            wb_file.write(content)
            
        file_infos.append({
            "path": f"{settings.TRANSCRIPT_UPLOAD_DIR}/{unique_filename}",
            "filename": f.filename
        })

    if not file_infos:
        raise HTTPException(status_code=400, detail="No valid files uploaded")

    # 4. Set stage status to "processing" so evaluation polling returns 202
    current_stage.status = "processing"
    await db.commit()

    # 5. Trigger merged background processing
    process_transcript_task.delay(str(candidate_stage_id), file_infos, str(current_user.id))

    return {
        "message": f"Processing started for {len(file_infos)} files. They will be merged into a single transcript.",
        "candidate_stage_id": candidate_stage_id
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
                    HrDecision.decision.in_(["pass", "proceed", "passed"])
                )
                .limit(1)
            )
            decision_result = await db.execute(decision_query)
            if decision_result.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Cannot delete transcript because the candidate has already passed this stage.")
    
    
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
