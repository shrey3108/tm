"""
Admin Service Module (Facade).

Aggregates specialized admin services for backward compatibility and easy access.
"""

from typing import Any

from app.v1.db.models.audit_logs import AuditLog
from app.v1.db.models.jobs import Job
from app.v1.db.models.permissions import Permission
from app.v1.db.models.roles import Role
from app.v1.db.models.skills import Skill
from app.v1.db.models.user import User
from app.v1.schemas.admin import (
    AnalyticsSummary,
    HiringReport,
    JobPipelineStats,
)
from app.v1.schemas.skill import SkillRead
from app.v1.schemas.upload import CandidateResponse
from app.v1.services.admin.analytics_service import analytics_service
from app.v1.services.admin.audit_service import audit_service
from app.v1.services.admin.candidate_service import candidate_admin_service
from app.v1.services.admin.department_service import department_service
from app.v1.services.admin.job_service import job_admin_service
from app.v1.services.admin.role_service import role_service
from app.v1.services.admin.skill_service import skill_service
from app.v1.services.admin.system_service import system_service
from app.v1.services.admin.user_admin_service import user_admin_service


class AdminService:
    """
    Facade service for admin-level business operations.
    Delegates to specialized services in the admin/ directory.
    """

    # Audit Logging
    async def log_action(self, *args, **kwargs) -> None:
        return await audit_service.log_action(*args, **kwargs)

    async def get_audit_logs(self, *args, **kwargs) -> list[Any]:
        return await audit_service.get_audit_logs(*args, **kwargs)

    async def get_candidates_for_job(self, *args, **kwargs) -> dict[str, Any]:
        return await candidate_admin_service.get_candidates_for_job(*args, **kwargs)

    # User Management
    async def get_all_users(self, *args, **kwargs) -> list[User]:
        return await user_admin_service.get_all_users(*args, **kwargs)

    async def get_user_by_id(self, *args, **kwargs) -> User:
        return await user_admin_service.get_user_by_id(*args, **kwargs)

    async def create_user(self, *args, **kwargs) -> User:
        return await user_admin_service.create_user(*args, **kwargs)

    async def update_user(self, *args, **kwargs) -> User:
        return await user_admin_service.update_user(*args, **kwargs)

    async def delete_user(self, *args, **kwargs) -> None:
        return await user_admin_service.delete_user(*args, **kwargs)

    # Role & Permission Management
    async def get_all_roles(self, *args, **kwargs) -> list[Role]:
        return await role_service.get_all_roles(*args, **kwargs)

    async def get_role_by_id(self, *args, **kwargs) -> Role:
        return await role_service.get_role_by_id(*args, **kwargs)

    async def create_role(self, *args, **kwargs) -> Role:
        return await role_service.create_role(*args, **kwargs)

    async def update_role(self, *args, **kwargs) -> Role:
        return await role_service.update_role(*args, **kwargs)

    async def delete_role(self, *args, **kwargs) -> None:
        return await role_service.delete_role(*args, **kwargs)

    async def get_all_permissions(self, *args, **kwargs) -> list[Permission]:
        return await role_service.get_all_permissions(*args, **kwargs)

    async def create_permission(self, *args, **kwargs) -> Permission:
        return await role_service.create_permission(*args, **kwargs)

    async def delete_permission(self, *args, **kwargs) -> None:
        return await role_service.delete_permission(*args, **kwargs)

    # Analytics
    async def get_recent_uploads(self, *args, **kwargs) -> list[Any]:
        return await analytics_service.get_recent_uploads(*args, **kwargs)

    async def get_analytics_summary(self, *args, **kwargs) -> AnalyticsSummary:
        return await analytics_service.get_analytics_summary(*args, **kwargs)

    async def get_hiring_report(self, *args, **kwargs) -> HiringReport:
        return await analytics_service.get_hiring_report(*args, **kwargs)

    async def get_pipeline_stats(self, *args, **kwargs) -> list[JobPipelineStats]:
        return await analytics_service.get_pipeline_stats(*args, **kwargs)

    # Job Management
    async def get_all_jobs(self, *args, **kwargs) -> list[Job]:
        return await job_admin_service.get_all_jobs(*args, **kwargs)

    async def get_job_by_id(self, *args, **kwargs) -> Job:
        return await job_admin_service.get_job_by_id(*args, **kwargs)

    async def get_job_version(self, *args, **kwargs) -> Any:
        return await job_admin_service.get_job_version(*args, **kwargs)

    async def create_job(self, *args, **kwargs) -> Job:
        return await job_admin_service.create_job(*args, **kwargs)

    async def update_job(self, *args, **kwargs) -> Job:
        return await job_admin_service.update_job(*args, **kwargs)

    async def update_job_status(self, *args, **kwargs) -> Job:
        return await job_admin_service.update_job_status(*args, **kwargs)

    async def get_job_activity_history(self, *args, **kwargs) -> Any:
        return await job_admin_service.get_job_activity_history(*args, **kwargs)

    async def delete_job(self, *args, **kwargs) -> None:
        return await job_admin_service.delete_job(*args, **kwargs)

    # Department Management
    async def get_all_departments(self, *args, **kwargs):
        return await department_service.get_all_departments(*args, **kwargs)

    async def get_department_by_id(self, *args, **kwargs):
        return await department_service.get_department_by_id(*args, **kwargs)

    async def create_department(self, *args, **kwargs):
        return await department_service.create_department(*args, **kwargs)

    async def update_department(self, *args, **kwargs):
        return await department_service.update_department(*args, **kwargs)

    async def delete_department(self, *args, **kwargs):
        return await department_service.delete_department(*args, **kwargs)

    # Skill Management
    async def get_all_skills(self, *args, **kwargs):
        return await skill_service.get_all_skills(*args, **kwargs)

    async def get_skill_by_id(self, *args, **kwargs) -> Skill:
        return await skill_service.get_skill_by_id(*args, **kwargs)

    async def create_skill(self, *args, **kwargs) -> Skill:
        return await skill_service.create_skill(*args, **kwargs)

    async def update_skill(self, *args, **kwargs) -> Skill | SkillRead:
        return await skill_service.update_skill(*args, **kwargs)

    async def delete_skill(self, *args, **kwargs) -> None:
        return await skill_service.delete_skill(*args, **kwargs)


    async def search_candidates(self, *args, **kwargs) -> list[CandidateResponse]:
        return await candidate_admin_service.search_candidates(*args, **kwargs)

    async def delete_candidate(self, *args, **kwargs) -> bool:
        return await candidate_admin_service.delete_candidate_by_identifier(*args, **kwargs)

    # Candidate evaluations removed as part of resume-screening focus.


    # System Management
    async def clear_cache(self, *args, **kwargs) -> bool:
        return await system_service.clear_cache(*args, **kwargs)

    async def get_cache_info(self, *args, **kwargs) -> dict:
        return await system_service.get_cache_info(*args, **kwargs)


admin_service = AdminService()
