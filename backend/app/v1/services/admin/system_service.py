"""
System management service.

Handles system-wide administrative tasks like cache management.
"""

import logging
from app.v1.core.cache import cache

_log = logging.getLogger(__name__)

class SystemService:
    """Service for system-wide administrative operations."""

    async def clear_cache(self) -> bool:
        """
        Clear application-specific cache keys (selective delete).
        This avoids deleting internal Celery/Broker keys.
        """
        _log.info("Comprehensive selective cache clear started")
        
        patterns = [
            "job*",
            "analytics*",
            "skills:*",
            "departments:*",
            "positions:*",
            "priorities:*",
            "locations:*",
            "prompts:*",
            "criteria:*",
            "stage_templates:*",
            "candidates:*"
        ]
        
        success = True
        for pattern in patterns:
            res = await cache.clear(pattern=pattern)
            if not res:
                success = False
                _log.warning("Failed to clear pattern: %s", pattern)
        
        _log.info("Comprehensive selective cache clear completed. Success: %s", success)
        return success

    async def invalidate_job_cache(self, job_id: str | uuid.UUID) -> None:
        """
        Invalidate all cache keys related to a specific job.
        Used when a candidate's status or job data changes.
        """
        jid = str(job_id)
        _log.info("Aggressive cache invalidation for job_id=%s", jid)
        
        # 1. Clear Job Specific Stats & Analytics
        await cache.delete(f"job_stats:{jid}")
        await cache.clear(pattern=f"analytics:hiring_report:{jid}:*")
        await cache.clear(pattern=f"analytics:pipeline_stats:{jid}:*")
        
        # 2. Aggressive Candidate List Clearing (matches any pagination/filter combo)
        await cache.clear(pattern=f"candidates:for_job:{jid}*") 
        
        # 3. Clear Global State that might be affected
        await cache.delete("analytics:summary")
        await cache.clear(pattern="jobs:list:*")
        await cache.clear(pattern="jobs:search:*")
        
        _log.info("Aggressive cache invalidation completed for job_id=%s", jid)

# Global instance
system_service = SystemService()
