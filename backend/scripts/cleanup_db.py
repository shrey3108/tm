
import asyncio
import uuid
from sqlalchemy import select, delete, func
from app.v1.db.session import async_session_maker
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.resumes import Resume
from app.v1.db.models.files import File
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.hr_decisions import HrDecision
from app.v1.db.models.resume_chunks import ResumeChunk

async def cleanup():
    async with async_session_maker() as db:
        print("--- Starting Strict Database Cleanup ---")
        
        # 1. Delete all "Ghost" placeholder entries (No email, Parsing name)
        ghost_ids_stmt = select(Candidate.id).where(
            Candidate.email.is_(None),
            Candidate.first_name.ilike("%Parsing%")
        )
        ghost_ids = (await db.execute(ghost_ids_stmt)).scalars().all()
        
        if ghost_ids:
            print(f"Found {len(ghost_ids)} ghost placeholder entries. Deleting them...")
            
            # Delete related records first to avoid foreign key violations
            # Resumes and chunks
            resume_ids_subq = select(Resume.id).where(Resume.candidate_id.in_(ghost_ids))
            await db.execute(delete(ResumeChunk).where(ResumeChunk.resume_id.in_(resume_ids_subq)))
            await db.execute(delete(Resume).where(Resume.candidate_id.in_(ghost_ids)))
            
            # Files, Stages, Decisions
            await db.execute(delete(File).where(File.candidate_id.in_(ghost_ids)))
            await db.execute(delete(CandidateStage).where(CandidateStage.candidate_id.in_(ghost_ids)))
            await db.execute(delete(HrDecision).where(HrDecision.candidate_id.in_(ghost_ids)))
            
            # Delete the ghost candidates
            await db.execute(delete(Candidate).where(Candidate.id.in_(ghost_ids)))
            print(f"Successfully removed {len(ghost_ids)} ghost entries.")
        else:
            print("No ghost placeholder entries found.")

        # 2. Strict Deduplication by Email (Keep only the LATEST record)
        dupe_emails_stmt = select(Candidate.email).where(Candidate.email.is_not(None)).group_by(Candidate.email).having(func.count(Candidate.id) > 1)
        dupe_emails = (await db.execute(dupe_emails_stmt)).scalars().all()
        
        print(f"Found {len(dupe_emails)} emails with duplicate records.")
        
        for email in dupe_emails:
            # Get all candidates with this email, ordered by creation (newest first)
            stmt = select(Candidate).where(func.lower(Candidate.email) == email.lower()).order_by(Candidate.created_at.desc())
            candidates = (await db.execute(stmt)).scalars().all()
            
            # Keep the newest one (candidates[0])
            master = candidates[0]
            to_delete = candidates[1:]
            
            print(f"STRICT OVERRIDE: Keeping latest record for {email} ({master.id}), deleting {len(to_delete)} older records.")
            
            for dupe in to_delete:
                # Delete everything related to the old duplicate
                # Delete resume chunks
                resume_ids_subq = select(Resume.id).where(Resume.candidate_id == dupe.id)
                await db.execute(delete(ResumeChunk).where(ResumeChunk.resume_id.in_(resume_ids_subq)))
                
                # Delete resumes, files, stages, and decisions for the old record
                await db.execute(delete(Resume).where(Resume.candidate_id == dupe.id))
                await db.execute(delete(File).where(File.candidate_id == dupe.id))
                await db.execute(delete(CandidateStage).where(CandidateStage.candidate_id == dupe.id))
                await db.execute(delete(HrDecision).where(HrDecision.candidate_id == dupe.id))
                
                # Delete the candidate record itself
                await db.delete(dupe)
        
        await db.commit()
        print("--- Database is now CLEAN and DEDUPLICATED ---")

if __name__ == "__main__":
    asyncio.run(cleanup())
