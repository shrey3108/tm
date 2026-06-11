
import asyncio
from app.v1.db.session import engine
from sqlalchemy import select, update
from app.v1.db.models.candidate_stages import CandidateStage
from app.v1.db.models.candidates import Candidate

async def prepare_test_candidate():
    async with engine.begin() as conn:
        # Find a candidate who is not Heer or Sameer
        res = await conn.execute(
            select(Candidate.id, Candidate.first_name, Candidate.last_name)
            .where(Candidate.id != '019db43c-d112-7443-b662-933d05505ad4') # Not Heer
            .where(Candidate.id != '019daae7-1736-7244-b6b1-e0a529e68cc3') # Not Sameer
            .limit(1)
        )
        row = res.fetchone()
        if not row:
            print("No other candidates found.")
            return
        
        cid = row.id
        name = f"{row.first_name} {row.last_name}"
        print(f"Selected Candidate: {name} ({cid})")
        
        # Ensure they have a pending stage
        res_stage = await conn.execute(
            select(CandidateStage.id).where(CandidateStage.candidate_id == cid).limit(1)
        )
        stage_id = res_stage.scalar()
        
        if stage_id:
            await conn.execute(
                update(CandidateStage).where(CandidateStage.id == stage_id).values(status='pending')
            )
            print(f"Reset stage {stage_id} to 'pending' for {name}.")
        else:
            # Fallback: find any JobStageConfig
            from app.v1.db.models.job_stage_configs import JobStageConfig
            res_js = await conn.execute(select(JobStageConfig.id).limit(1))
            jsid = res_js.scalar()
            if jsid:
                await conn.execute(
                    CandidateStage.__table__.insert().values(
                        candidate_id=cid,
                        job_stage_id=jsid,
                        status='pending'
                    )
                )
                print(f"Created new 'pending' stage for {name}.")
        
        return cid, name

if __name__ == "__main__":
    asyncio.run(prepare_test_candidate())
