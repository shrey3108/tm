
import asyncio
from app.v1.db.session import engine
from sqlalchemy import select
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.job_stage_configs import JobStageConfig
from app.v1.db.models.candidate_stages import CandidateStage

async def setup():
    async with engine.begin() as conn:
        res = await conn.execute(
            select(Candidate.applied_job_id)
            .where(Candidate.id == '019db43c-d112-7443-b662-933d05505ad4')
        )
        jid = res.scalar()
        print(f"Candidate Applied Job ID: {jid}")
        
        if not jid:
            # Fallback to any job if none applied (for testing)
            res_job = await conn.execute(select(JobStageConfig.job_id).limit(1))
            jid = res_job.scalar()
            print(f"No job found for candidate, fallback to: {jid}")

        # Find Stage 1 config for this job
        res_stage = await conn.execute(
            select(JobStageConfig.id)
            .where(JobStageConfig.job_id == jid, JobStageConfig.stage_order == 1)
        )
        sid = res_stage.scalar()
        
        if sid:
            # Create the stage record
            await conn.execute(
                CandidateStage.__table__.insert().values(
                    candidate_id='019db43c-d112-7443-b662-933d05505ad4',
                    job_stage_id=sid,
                    status='pending'
                )
            )
            print(f"Created pending stage for Heer Patel (Stage 1).")
        else:
            print("Could not find Stage 1 config for this job.")

if __name__ == "__main__":
    asyncio.run(setup())
