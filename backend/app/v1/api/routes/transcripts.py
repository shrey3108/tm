import hashlib
import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.session import get_db
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.files import File as DBFile
from app.v1.db.models.interviews import Interview
from app.v1.db.models.transcript_chunks import TranscriptChunk
from app.v1.db.models.transcripts import Transcript
from app.v1.utils.transcript_parser import process_transcript_file
from app.v1.core.embeddings import EmbeddingService

router = APIRouter(prefix="/transcripts", tags=["Transcripts"])

@router.post("/upload")
async def upload_transcript(
    candidate_id: Annotated[uuid.UUID, Form(...)],
    file: UploadFile = File(...),
    custom_criteria: Annotated[str | None, Form(description="Optional JSON array of criteria for testing overrides")] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Upload an interview transcript (.docx, .pdf) for a candidate.
    
    The system automatically detects the current active 'pending' candidate stage, 
    processes the file (cleans, chunks, embeds), and avoids duplicates via SHA-256 hashing.
    """
    # 1. Validate File Ext
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    ext = ""
    if "." in file.filename:
        ext = f".{file.filename.split('.')[-1].lower()}"
        
    if ext not in {".docx", ".pdf"}:
         raise HTTPException(status_code=400, detail="Only .docx and .pdf files are allowed for transcripts.")

    # 2. Check Candidate exists
    candidate = await db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # 3. Auto-detect the current active pipeline stage for this candidate
    # We look for the first 'pending' candidate_stage ordered by whatever stage order mechanic exists
    # (Assuming candidate_stages holds the sequence. If there's an explicit order, we can add it to the query)
    query = (
        select(CandidateStage)
        .where(CandidateStage.candidate_id == candidate_id)
        .where(CandidateStage.status == "pending")
        # Order by created_at or job_stage_id ideally if multiple exist. 
        # For now, taking the first pending sequential stage.
    )
    result = await db.execute(query)
    current_stage = result.scalars().first()

    if not current_stage:
        raise HTTPException(
            status_code=400, 
            detail="No valid 'pending' active stage found for this candidate. Ensure they passed screening."
        )

    # 4. Extract and Process the File
    content = await file.read()
    
    try:
        processed_data = process_transcript_file(content, ext)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse document: {str(e)}")
        
    clean_text = processed_data["raw_clean_text"]
    
    # 5. Prevent Duplicates (Hash the clean text)
    transcript_hash = hashlib.sha256(clean_text.encode('utf-8')).hexdigest()
    
    existing_check = await db.execute(
        select(Transcript).where(Transcript.transcript_hash == transcript_hash)
    )
    if existing_check.scalar_one_or_none():
         raise HTTPException(
             status_code=status.HTTP_409_CONFLICT, 
             detail="This exact transcript has already been processed for an evaluation."
         )

    # 6. Database Insertions (File, Interview placeholder, Transcript, Chunks)
    
    # a. File entry
    db_file = DBFile(
        candidate_id=candidate_id,
        file_name=file.filename,
        file_type=ext.replace('.', ''),
        size=len(content),
    )
    db.add(db_file)
    await db.flush() # flush to get file.id

    # b. Ensure an Interview session exists for this stage to link the transcript
    
    # Simple fix for POC: Fetch first user to use as interviewer
    from app.v1.db.models.user import User
    first_user = await db.execute(select(User).limit(1))
    interviewer = first_user.scalar_one_or_none()
    
    interview = Interview(
        candidate_id=candidate_id,
        job_id=candidate.applied_job_id,
        interviewer_id=interviewer.id if interviewer else candidate_id, # Fallback
        stage=1, # Can be enhanced by reading stage template details
        status="completed" # Because HR uploaded the post-interview transcript
    )
    db.add(interview)
    await db.flush()

    # c. Create Transcript Main Record
    transcript = Transcript(
        interview_id=interview.id,
        file_id=db_file.id,
        clean_transcript_text=clean_text,
        transcript_hash=transcript_hash
    )
    db.add(transcript)
    await db.flush()

    # d. Generate Embeddings & Save Chunks
    # This might take a few seconds in production, usually pushed to Celery. Doing inline for POC API.
    embedding_service = EmbeddingService()
    
    chunks_text = processed_data.get("chunks", [])
    db_chunks = []
    
    for idx, chunk_text in enumerate(chunks_text):
        # Generate semantic vector
        vector = embedding_service.encode_transcript(chunk_text)
        
        chunk_record = TranscriptChunk(
            transcript_id=transcript.id,
            chunk_index=idx,
            text_content=chunk_text,
            embedding=vector
        )
        db_chunks.append(chunk_record)
        
    db.add_all(db_chunks)
    
    # 7. Update Candidate Stage Status to Processing
    current_stage.status = "processing" # Indicates the AI Agent now needs to evaluate it
    
    await db.commit()

    return {
        "message": "Transcript uploaded and processed successfully.",
        "transcript_id": transcript.id,
        "candidate_stage_id": current_stage.id,
        "stats": {
            "dialogue_turns": processed_data["dialogue_count"],
            "chunks_created": len(chunks_text),
            "hashing": "Duplicate check passed via SHA-256",
        },
        "next_step": "System will now trigger the AI Evaluation Agent."
    }