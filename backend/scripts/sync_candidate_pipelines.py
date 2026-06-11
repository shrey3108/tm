
import asyncio
import uuid
from sqlalchemy import select
from app.v1.db.session import async_session_maker
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.cross_job_matches import CrossJobMatch
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.services.candidate_stage_service import candidate_stage_service

async def sync_pipelines():
    print("Starting pipeline sync...")
    async with async_session_maker() as db:
        # 1. Find all Native applications
        candidates_stmt = select(Candidate.id, Candidate.applied_job_id)
        candidates = (await db.execute(candidates_stmt)).all()
        
        for cid, jid in candidates:
            if jid:
                # Check if pipeline exists
                check_stmt = select(CandidateStage.id).where(CandidateStage.candidate_id == cid).limit(1)
                if not (await db.execute(check_stmt)).scalar():
                    print(f"Missing pipeline for Native Candidate {cid} in Job {jid}. Initializing...")
                    await candidate_stage_service.initiate_candidate_pipeline(db, cid, jid)
        
        # 2. Find all Cross-job matches
        xm_stmt = select(CrossJobMatch.candidate_id, CrossJobMatch.matched_job_id)
        xms = (await db.execute(xm_stmt)).all()
        
        for cid, jid in xms:
            # Check if pipeline exists for this SPECIFIC job
            from app.v1.db.models.job_stage_configs import JobStageConfig
            check_stmt = (
                select(CandidateStage.id)
                .join(JobStageConfig, CandidateStage.job_stage_id == JobStageConfig.id)
                .where(CandidateStage.candidate_id == cid, JobStageConfig.job_id == jid)
                .limit(1)
            )
            if not (await db.execute(check_stmt)).scalar():
                print(f"Missing pipeline for Cross-Match Candidate {cid} in Job {jid}. Initializing...")
                await candidate_stage_service.initiate_candidate_pipeline(db, cid, jid)
        
        await db.commit()
        print("Pipeline sync complete!")

if __name__ == "__main__":
    asyncio.run(sync_pipelines())
