import asyncio
import uuid
import logging
from sqlalchemy import select
from app.v1.db.session import async_session_maker
from app.v1.db.models.associates import Associate

from app.v1.db.models.designations import Designation

logger = logging.getLogger(__name__)

ASSOCIATES_TO_SEED = [
    {
        "name": "HR Manager",
        "email": "hr@company.com",
        "designation": "HR"
    },
    {
        "name": "Chief Technology Officer",
        "email": "cto@company.com",
        "designation": "CTO"
    },
    {
        "name": "Senior Developer",
        "email": "dev@company.com",
        "designation": "DEV"
    }
]

async def seed_associates():
    async with async_session_maker() as db:
        logger.info("Checking for existing Designations and Associates...")
        
        for assoc_data in ASSOCIATES_TO_SEED:
            desig_name = assoc_data["designation"]
            
            # 1. Seed Designation
            desig_stmt = select(Designation).where(Designation.name == desig_name)
            desig_res = await db.execute(desig_stmt)
            designation = desig_res.scalar_one_or_none()
            
            if not designation:
                designation = Designation(name=desig_name)
                db.add(designation)
                await db.commit()
                await db.refresh(designation)
                logger.info(f"Seeded designation: {desig_name}")
            
            # 2. Seed Associate
            stmt = select(Associate).where(Associate.email == assoc_data["email"])
            res = await db.execute(stmt)
            existing_assoc = res.scalar_one_or_none()
            
            if not existing_assoc:
                new_assoc = Associate(
                    id=uuid.uuid4(),
                    name=assoc_data["name"],
                    email=assoc_data["email"],
                    designation_id=designation.id
                )
                db.add(new_assoc)
                logger.info(f"Seeded associate: {assoc_data['name']} ({assoc_data['designation']})")
            else:
                logger.info(f"Associate {assoc_data['name']} ({assoc_data['email']}) already exists. Skipping.")
                
        await db.commit()
        logger.info("Finished seeding Associates.")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed_associates())
