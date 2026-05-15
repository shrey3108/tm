"""
API v1 router module.

This module aggregates all API v1 sub-routers and provides
the main API router for the application.
"""

from fastapi import APIRouter

from app.v1.routes.admin import router as admin_router
from app.v1.routes.admin_system import router as admin_system_router
from app.v1.routes.candidates import router as candidates_router
from app.v1.routes.health import router as health_router
from app.v1.routes.departments import router as departments_router
from app.v1.routes.jobs import router as jobs_router
from app.v1.routes.resume_upload import router as resume_upload_router
from app.v1.routes.skills import router as skills_router
from app.v1.routes.users import router as auth_router
from app.v1.routes.cross_job_matches import router as cross_job_match_router
from app.v1.routes.locations import router as locations_router
from app.v1.routes.job_priorities import router as job_priorities_router
from app.v1.routes.transcripts import router as transcripts_router
from app.v1.routes.job_stages import router as job_stages_router
from app.v1.routes.candidate_stages import router as candidate_stages_router
from app.v1.routes.job_positions import router as job_positions_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(auth_router, prefix="/users", tags=["users"])
api_router.include_router(resume_upload_router, tags=["resume-upload"])
api_router.include_router(jobs_router, prefix="/jobs", tags=["jobs"])
api_router.include_router(skills_router, prefix="/skills", tags=["skills"])
api_router.include_router(departments_router, prefix="/departments", tags=["departments"])
api_router.include_router(candidates_router, prefix="/candidates", tags=["candidates"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])
api_router.include_router(admin_system_router, prefix="/admin", tags=["admin"])
api_router.include_router(cross_job_match_router, prefix="/cross-match", tags=["cross-match"])
api_router.include_router(locations_router, prefix="/locations", tags=["locations"])
api_router.include_router(job_priorities_router, prefix="/job-priorities", tags=["job-priorities"])
api_router.include_router(transcripts_router)
api_router.include_router(job_stages_router, tags=["job-stages"])
api_router.include_router(candidate_stages_router, tags=["candidate-stages"])
api_router.include_router(job_positions_router, prefix="/job-positions", tags=["job-positions"])

