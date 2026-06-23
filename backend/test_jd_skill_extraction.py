import pytest
import uuid
import re
import os
import sys
from unittest.mock import patch, AsyncMock

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import select, delete, text
from app.v1.db.session import engine, async_session_maker
from app.v1.db.models.skills import Skill
from app.v1.db.models.jobs import Job
from app.v1.schemas.job import JobCreate, JobUpdate, StageInput
from app.v1.services.admin.job_service import job_admin_service
from app.v1.utils.uuid import UUIDHelper

@pytest.mark.anyio
async def test_jd_skill_extraction_and_fallback():
    test_id_suffix = str(UUIDHelper.generate_uuid7())[:8]
    job_title = f"Test JD Job {test_id_suffix}"
    
    # 1. Setup mock position, department, user, and initial skills
    async with engine.begin() as conn:
        # Create department
        department_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text("INSERT INTO departments (id, name, description) VALUES (:id, :name, 'Test Dept')"),
            {"id": department_id, "name": f"Dept {test_id_suffix}"}
        )
        # Create job position
        position_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text("INSERT INTO job_positions (id, name, created_at, updated_at) VALUES (:id, :name, NOW(), NOW())"),
            {"id": position_id, "name": f"Position {test_id_suffix}"}
        )
        # Create user
        user_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text("INSERT INTO users (id, email, password_hash, is_active, created_at, updated_at) VALUES (:id, :email, 'hash', true, NOW(), NOW())"),
            {"id": user_id, "email": f"user_{test_id_suffix}@example.com"}
        )
        # Create a skill that already exists in DB
        existing_skill_id = UUIDHelper.generate_uuid7()
        await conn.execute(
            text("INSERT INTO skills (id, name, description) VALUES (:id, :name, 'Existing Skill')"),
            {"id": existing_skill_id, "name": f"PythonTestSkill{test_id_suffix}"}
        )

    # 2. Test LLM success path (extracts a custom skill and an existing skill)
    async with async_session_maker() as session:
        mock_response = AsyncMock()
        mock_response.choices = [
            AsyncMock(
                message=AsyncMock(
                    content=f'{{"skills": ["PythonTestSkill{test_id_suffix}", "BrandNewCustomSkill{test_id_suffix}"]}}'
                )
            )
        ]
        
        # Patch chat.completions.create to return our mock JSON content
        with patch("openai.resources.chat.completions.AsyncCompletions.create", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_response
            jd_text = f"We are looking for PythonTestSkill{test_id_suffix} and BrandNewCustomSkill{test_id_suffix} developers."
            
            job_in = JobCreate(
                title=job_title,
                position_id=position_id,
                department_id=department_id,
                jd_text=jd_text,
                skill_ids=[existing_skill_id] # Pass existing skill ID manually too
            )
            
            # Create Job
            job = await job_admin_service.create_job(db=session, admin_user_id=user_id, job_in=job_in)
            
            # Verify both python skill and brand new custom skill were linked
            skill_names = [s.name for s in job.skills]
            assert f"PythonTestSkill{test_id_suffix}" in skill_names
            assert f"BrandNewCustomSkill{test_id_suffix}" in skill_names
            assert len(job.skills) >= 2
            
            # Verify the brand new custom skill was actually created in the DB
            stmt = select(Skill).where(Skill.name == f"BrandNewCustomSkill{test_id_suffix}")
            custom_skill = (await session.execute(stmt)).scalar_one_or_none()
            assert custom_skill is not None
            assert custom_skill.description == "Auto-extracted skill from JD description."

    # 3. Test LLM failure / Fallback to Regex database keyword matching
    async with async_session_maker() as session:
        # Create another skill in database
        another_skill_id = UUIDHelper.generate_uuid7()
        another_skill_name = f"DjangoTestSkill{test_id_suffix}"
        session.add(Skill(id=another_skill_id, name=another_skill_name, description="Test Django"))
        await session.flush()
        
        # Mock completions.create to raise an exception
        with patch("openai.resources.chat.completions.AsyncCompletions.create", new_callable=AsyncMock) as mock_create:
            mock_create.side_effect = Exception("Ollama offline")
            jd_text_fallback = f"This role requires {another_skill_name} expertise."
            
            job_in_fallback = JobCreate(
                title=f"{job_title} Fallback",
                position_id=position_id,
                department_id=department_id,
                jd_text=jd_text_fallback,
                skill_ids=[]
            )
            
            # Create Job
            job_fallback = await job_admin_service.create_job(db=session, admin_user_id=user_id, job_in=job_in_fallback)
            
            # Verify another_skill_name was matched and linked via regex fallback
            skill_names_fallback = [s.name for s in job_fallback.skills]
            assert another_skill_name in skill_names_fallback

    # 4. Test Job Update path
    async with async_session_maker() as session:
        # Mock update call with a new skill in the JD text
        mock_response = AsyncMock()
        mock_response.choices = [
            AsyncMock(
                message=AsyncMock(
                    content=f'{{"skills": ["SuperUpdateSkill{test_id_suffix}"]}}'
                )
            )
        ]
        
        with patch("openai.resources.chat.completions.AsyncCompletions.create", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_response
            job_update = JobUpdate(
                jd_text=f"Now we want SuperUpdateSkill{test_id_suffix}"
            )
            
            updated_job = await job_admin_service.update_job(
                db=session,
                admin_user_id=user_id,
                job_id=job.id,
                job_update=job_update
            )
            
            skill_names_updated = [s.name for s in updated_job.skills]
            # Verify the old skills (from creation) are still there + new updating skill is added
            assert f"PythonTestSkill{test_id_suffix}" in skill_names_updated
            assert f"SuperUpdateSkill{test_id_suffix}" in skill_names_updated
