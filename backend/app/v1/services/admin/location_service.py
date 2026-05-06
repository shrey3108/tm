"""
Location service for fetching location data (used for filtering).
"""

import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.models.locations import Location
from app.v1.db.models.candidates import Candidate
from app.v1.schemas.location import LocationRead
from app.v1.schemas.response import PaginatedData
from app.v1.core.cache import cache


class LocationService:
    """
    Service for location lookup operations (read-only).
    """

    async def get_all_locations(
        self, 
        db: AsyncSession, 
        skip: int = 0, 
        limit: int = 500, 
        q: str | None = None,
        job_id: uuid.UUID | None = None
    ) -> PaginatedData[LocationRead]:
        """Get all locations with pagination, ordered alphabetically."""
        # 0. Cache lookup
        cache_key = f"locations:list:{skip}:{limit}:{q or 'none'}:{job_id or 'none'}"
        cached = await cache.get(cache_key)
        if cached:
            try:
                return PaginatedData[LocationRead](
                    data=[LocationRead.model_validate(l) for l in cached["data"]],
                    total=cached["total"]
                )
            except Exception:
                pass

        query = select(Location)
        
        if job_id:
            from app.v1.db.models.cross_job_matches import CrossJobMatch
            from sqlalchemy import or_
            query = query.join(Candidate).outerjoin(CrossJobMatch, CrossJobMatch.candidate_id == Candidate.id).where(
                or_(Candidate.applied_job_id == job_id, CrossJobMatch.matched_job_id == job_id)
            ).distinct()

        if q:
            search_term = f"%{q.strip()}%"
            query = query.where(Location.name.ilike(search_term))
            
        total_stmt = select(func.count()).select_from(query.subquery())
        total = await db.scalar(total_stmt)

        from sqlalchemy import case

        locations = (
            await db.scalars(
                query.order_by(
                    case((func.lower(Location.name) == "surat", 0), else_=1),
                    Location.name.asc()
                )
                .offset(skip)
                .limit(limit)
            )
        ).all()

        res = PaginatedData[LocationRead](
            data=[LocationRead.model_validate(loc) for loc in locations],
            total=total or 0,
        )
        
        # Cache the result (1 hour)
        await cache.set(cache_key, {
            "data": [l.model_dump() for l in res.data],
            "total": res.total
        }, ttl=3600)
        
        return res


location_service = LocationService()
