
import asyncio
import json
from app.v1.db.session import engine
from sqlalchemy import select, update
from app.v1.db.models.criteria import Criterion
from app.v1.db.models.job_stage_configs import JobStageConfig

async def update_job_config():
    async with engine.begin() as conn:
        # 1. Fetch official criteria IDs
        res = await conn.execute(select(Criterion.id, Criterion.name))
        criteria_map = {row.name: str(row.id) for row in res.fetchall()}
        
        # 2. Define our target active criteria with weights (total 100%)
        # Matches names from seed_criteria.py
        target_names = [
            "Communication",
            "Confidence", 
            "Cultural Fit",
            "Profile Understanding",
            "Tech Stack",
            "Salary Alignment"
        ]
        
        active_criteria = []
        for name in target_names:
            if name in criteria_map:
                active_criteria.append({
                    "id": criteria_map[name],
                    "weight": 16.66 # Roughly equal weights for now
                })

        # 3. Update the JobStageConfig for the specific job and stage
        job_id = "019d9b2d-9120-75e4-9692-89840755718d"
        stage_id = "019da3b5-39af-7222-9c92-89e5bfe9eb04"
        
        new_config = {
            "type": "audio",
            "active_criteria": active_criteria,
            "version": "2.0" # Indicating new format
        }
        
        await conn.execute(
            update(JobStageConfig)
            .where(JobStageConfig.id == stage_id)
            .values(config=new_config)
        )
        print(f"Successfully updated Job Stage {stage_id} to the new configuration format.")
        print(f"Injected {len(active_criteria)} official criteria.")

if __name__ == "__main__":
    asyncio.run(update_job_config())
