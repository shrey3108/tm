
import asyncio
from app.v1.db.session import engine
from sqlalchemy import select
from app.v1.db.models.evaluations import Evaluation

async def check_evals():
    async with engine.begin() as conn:
        res = await conn.execute(select(Evaluation).order_by(Evaluation.created_at.desc()).limit(5))
        rows = res.fetchall()
        print(f"Found {len(rows)} evaluations.")
        for row in rows:
            print(f"ID: {row.id}, CandidateStageID: {row.candidate_stage_id}, Score: {row.overall_score}")

if __name__ == "__main__":
    asyncio.run(check_evals())
