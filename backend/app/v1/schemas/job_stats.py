"""
Schema for the Job Stats endpoint.

Provides a comprehensive breakdown of candidates for a specific job:
  - result: AI screening pass/fail counts (includes cross-matches)
  - location: candidate count per city/location
  - stages: candidate count per hiring pipeline stage
  - hr_decisions: HR decision summary (approved, rejected, maybe, pending)
  - priority_timeline: priority due-date graph data
"""

from __future__ import annotations

from pydantic import BaseModel


class JobResultStats(BaseModel):
    """AI resume-screening pass/fail breakdown."""

    passed: int = 0
    failed: int = 0
    pending: int = 0


class JobHRDecisionStats(BaseModel):
    """HR decision summary for a job."""

    total_candidates: int = 0
    passed: int = 0
    failed: int = 0
    maybe: int = 0
    pending: int = 0
    undecidedCount: int = 0


class JobPriorityTimeline(BaseModel):
    """
    Priority period breakdown for timeline/graph display.

    Frontend can use this to render:
      1. A progress ring/bar  →  progress_pct, days_remaining, days_total
    """

    name: str                           # e.g. "P1"
    start_date: str | None = None       # ISO date string
    due_date: str | None = None         # ISO date string (priority_end_date)
    days_total: int | None = None       # Total priority duration in days
    days_elapsed: int | None = None     # Days already passed since start
    days_remaining: int | None = None   # Days left until due date
    progress_pct: float | None = None   # 0-100 for progress ring/bar graph
    status: str = "not_set"             # "active" | "expired" | "not_started" | "not_set"


class JobStageDetails(BaseModel):
    """Stage-wise breakdown of HR and AI results."""
    
    hr_decisions: dict[str, int] = {} # { "pass": 5, "fail": 2, ... }
    ai_results: dict[str, int] = {}    # { "passed": 7, "failed": 3, ... }


class JobStatsResponse(BaseModel):
    """Full stats response for GET /candidates/jobs/{job_id}/stats."""

    result: JobResultStats
    location: dict[str, int]                  # { "Mumbai": 12, "Delhi": 5, ... }
    stages: dict[str, int]                    # { "HR Screening": 8, "Technical Round": 3, ... }
    hr_decisions: JobHRDecisionStats
    stage_details: dict[str, JobStageDetails] = {} # { "Resume Screening": { ... }, ... }
    priority_timeline: JobPriorityTimeline | None = None   # None if job has no priority set
