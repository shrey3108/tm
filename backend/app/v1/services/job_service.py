import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.repository.job_repository import job_repository


class JobService:
    """
    Service class for handling Job-related operations.
    """

    async def get_jobs(
        self, 
        db: AsyncSession, 
        skip: int = 0, 
        limit: int = 100, 
        query: str | None = None,
        status: list[bool] | None = None,
        department_ids: list[uuid.UUID] | None = None,
        priority_ids: list[uuid.UUID] | None = None,
        position_ids: list[uuid.UUID] | None = None,
    ):
        """
        Retrieve a list of jobs with pagination and global summaries.
        """
        from app.v1.services.admin.job_service import job_admin_service

        return await job_admin_service.get_all_jobs(
            db=db, 
            skip=skip, 
            limit=limit, 
            query=query, 
            status=status, 
            department_ids=department_ids,
            priority_ids=priority_ids,
            position_ids=position_ids
        )

    async def get_job_titles(self, db: AsyncSession, query: str | None = None):
        """
        Retrieve only the IDs and titles of all jobs.
        """
        from app.v1.services.admin.job_service import job_admin_service

        return await job_admin_service.get_job_titles(db=db, query=query)

    async def get_job_titles_grouped(self, db: AsyncSession, query: str | None = None):
        """
        Retrieve active jobs grouped by title with their position variants.
        """
        from app.v1.services.admin.job_service import job_admin_service

        return await job_admin_service.get_job_titles_grouped(db=db, query=query)

    async def search_jobs(
        self, db: AsyncSession, query: str, skip: int = 0, limit: int = 100
    ):
        """
        Search for jobs with global and per-job screening summaries.
        """
        from app.v1.services.admin.job_service import job_admin_service
        return await job_admin_service.search_jobs(db=db, query=query, skip=skip, limit=limit)


job_service = JobService()
