import logging
from pathlib import Path
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from github_code_evaluator.app.v1.core.security import get_current_user
from github_code_evaluator.app.v1.schemas.evaluation import ScoreDetail

logger = logging.getLogger(__name__)
router = APIRouter()

# Keep a local log path reference matching logging_config.py
LOG_FILE_PATH = Path("logs/app.log")


@router.get("", response_model=dict)
async def get_application_logs(
    limit: int = Query(default=100, ge=1, le=1000, description="Max number of log lines to return"),
    evaluation_id: Optional[UUID] = Query(default=None, description="Optional evaluation UUID to filter log lines"),
    current_user: dict = Depends(get_current_user),
):
    """Retrieve the latest application/worker log lines.
    
    Allows filtering by a specific evaluation ID to debug individual runs.
    """
    # Authorization check - only allow reviewers and admins
    if current_user.get("role") not in ("reviewer", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only reviewers and admin users can view application logs",
        )

    if not LOG_FILE_PATH.exists():
        return {
            "logs": [],
            "limit": limit,
            "total_retrieved": 0,
            "file_path": str(LOG_FILE_PATH)
        }

    try:
        # Read log lines safely
        with open(LOG_FILE_PATH, mode="r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
            
        # Strip trailing newlines
        lines = [line.rstrip("\r\n") for line in lines]

        # Apply evaluation ID filter if provided
        if evaluation_id:
            eval_str = str(evaluation_id)
            filtered_lines = [line for line in lines if eval_str in line]
        else:
            filtered_lines = lines

        # Get last 'limit' lines
        result_lines = filtered_lines[-limit:]

        return {
            "logs": result_lines,
            "limit": limit,
            "total_retrieved": len(result_lines),
            "file_path": str(LOG_FILE_PATH)
        }
    except Exception as e:
        logger.error(f"Error reading log file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error reading application logs: {str(e)}"
        )
