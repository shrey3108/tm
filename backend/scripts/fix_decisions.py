import asyncio
import uuid
from sqlalchemy import select, update
from app.v1.db.session import async_session_maker
from app.v1.db.models.hr_decisions import HrDecision
from app.v1.db.models.cross_job_matches import CrossJobMatch
from app.v1.db.models.candidates import Candidate

async def fix_missing_job_ids():
    async with async_session_maker() as session:
        print("Starting DB fix for missing job_ids in HrDecision...")
        
        # Find decisions where job_id is NULL
        stmt = select(HrDecision).where(HrDecision.job_id == None)
        result = await session.execute(stmt)
        decisions = result.scalars().all()
        
        count = 0
        for d in decisions:
            # For each decision, try to find if the candidate has a cross-match or applied job
            # If they have a cross-match, we assume the decision was for that job 
            # (This is a heuristic fix for the user's specific scenario)
            
            # Check cross-matches
            xm_stmt = select(CrossJobMatch.matched_job_id).where(CrossJobMatch.candidate_id == d.candidate_id)
            xm_res = await session.execute(xm_stmt)
            job_ids = xm_res.scalars().all()
            
            target_job_id = None
            if len(job_ids) == 1:
                # If only one cross-match, it's definitely for that
                target_job_id = job_ids[0]
            elif len(job_ids) == 0:
                # Fallback to natively applied job
                cand_stmt = select(Candidate.applied_job_id).where(Candidate.id == d.candidate_id)
                target_job_id = (await session.execute(cand_stmt)).scalar()

            if target_job_id:
                d.job_id = target_job_id
                count += 1
        
        if count > 0:
            await session.commit()
            print(f"Successfully fixed {count} decision records.")
        else:
            print("No records needed fixing or could not be determined safely.")

if __name__ == "__main__":
    asyncio.run(fix_missing_job_ids())
