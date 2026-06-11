import asyncio
from sqlalchemy import select, delete
from app.v1.db.session import async_session_maker
from app.v1.db.models.files import File
from app.v1.db.models.resumes import Resume

async def cleanup():
    async with async_session_maker() as session:
        # Find orphaned resumes
        resumes = (await session.execute(select(Resume).where(Resume.candidate_id == None))).scalars().all()
        print(f"Found {len(resumes)} orphaned resumes.")
        
        # Find orphaned files
        files = (await session.execute(select(File).where(File.candidate_id == None))).scalars().all()
        print(f"Found {len(files)} orphaned files.")
        
        # Delete them
        if resumes:
            await session.execute(delete(Resume).where(Resume.candidate_id == None))
        if files:
            await session.execute(delete(File).where(File.candidate_id == None))
            
        await session.commit()
        print("Cleanup complete.")

if __name__ == "__main__":
    asyncio.run(cleanup())
