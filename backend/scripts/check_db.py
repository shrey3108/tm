import asyncio
import uuid
from app.v1.db.session import async_session_maker
from app.v1.db.models.resumes import Resume
from sqlalchemy import select

async def check():
    cid = uuid.UUID('019d42a3-3ae8-757d-8436-85244469861b')
    async with async_session_maker() as db:
        r = await db.scalar(select(Resume).where(Resume.candidate_id == cid).order_by(Resume.uploaded_at.desc()).limit(1))
        if r:
            print(f"RESUME_SCORE: {r.resume_score}")
            print(f"PASS_FAIL: {r.pass_fail}")
            # print(f"SUMMARY: {r.parse_summary}")
        else:
            print("No resume found")

if __name__ == "__main__":
    asyncio.run(check())
