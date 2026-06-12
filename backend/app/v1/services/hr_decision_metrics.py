import uuid
from sqlalchemy import select, func, or_, and_, case, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.db.models.hr_decisions import HrDecision
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.resumes import Resume
from app.v1.db.models.cross_job_matches import CrossJobMatch
from app.v1.db.models.jobs import Job
from app.v1.schemas.hr_decision import HRDecisionSummary, HRJobDecisionSummary


async def get_decision_summary_impl(db: AsyncSession) -> HRDecisionSummary:
    """Get global summary: how many candidates are in each decision bucket."""
    # Total unique candidates in DB (by email, fallback to ID if email is null)
    total_result = await db.execute(
        select(func.count(func.distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text)))))
    )
    total_candidates = total_result.scalar() or 0

    # Counts per decision status (one latest decision per candidate)
    # We group by candidate_id and pick their latest decision
    subq = (
        select(
            HrDecision.candidate_id,
            HrDecision.decision,
            func.row_number()
            .over(
                partition_by=func.coalesce(HrDecision.candidate_id, func.cast(HrDecision.id, UUID)),
                order_by=(
                    case((func.lower(HrDecision.decision) == "pass", 0), (HrDecision.decision == "May Be", 1), else_=2),
                    HrDecision.decided_at.desc()
                ),
            )
            .label("rn"),
        )
    ).subquery()

    latest_decisions = await db.execute(
        select(subq.c.decision, func.count().label("cnt"))
        .where(subq.c.rn == 1)
        .group_by(subq.c.decision)
    )
    rows = latest_decisions.fetchall()

    counts = {row.decision: row.cnt for row in rows}
    decided_total = sum(counts.values())

    return HRDecisionSummary(
        total_candidates=total_candidates,
        passed_count=counts.get("pass", 0),
        failed_count=counts.get("fail", 0),
        maybe_count=counts.get("May Be", 0),
        undecided_count=max(total_candidates - decided_total, 0),
    )


async def get_job_decision_summary_impl(
    db: AsyncSession,
    job_id: uuid.UUID,
) -> HRJobDecisionSummary:
    """Get decision summary scoped to candidates of a specific job (including cross-matches)."""
    # Latest decision per candidate, filtered to decisions explicitly made for this job
    total_candidates_stmt = select(
        func.count(func.distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text))))
    ).where(
        or_(
            Candidate.applied_job_id == job_id,
            Candidate.id.in_(
                select(CrossJobMatch.candidate_id).where(CrossJobMatch.matched_job_id == job_id)
            )
        )
    )
    total_candidates = await db.scalar(total_candidates_stmt) or 0

    # Latest decision per candidate, filtered to decisions explicitly made for this job
    subq = (
        select(
            HrDecision.candidate_id,
            HrDecision.decision,
            func.row_number()
            .over(
                partition_by=HrDecision.candidate_id,
                order_by=HrDecision.decided_at.desc(),
            )
            .label("rn"),
        ).where(
            or_(
                HrDecision.job_id == job_id,
                # Fallback for old records that belong to natively applied candidates
                and_(
                    HrDecision.job_id.is_(None),
                    HrDecision.candidate_id.in_(
                        select(Candidate.id).where(
                            Candidate.applied_job_id == job_id
                        )
                    ),
                ),
            )
        )
    ).subquery()

    latest_decisions = await db.execute(
        select(subq.c.decision, func.count().label("cnt"))
        .where(subq.c.rn == 1)
        .group_by(subq.c.decision)
    )
    rows = latest_decisions.fetchall()

    counts = {row.decision: row.cnt for row in rows}
    decided_total = sum(counts.values())

    return HRJobDecisionSummary(
        job_id=job_id,
        total_candidates=total_candidates,
        passed_count=counts.get("pass", 0),
        failed_count=counts.get("fail", 0),
        maybe_count=counts.get("May Be", 0),
        undecided_count=max(total_candidates - decided_total, 0),
    )


async def get_job_screening_summary_impl(
    db: AsyncSession,
    job_id: uuid.UUID,
) -> dict[str, int]:
    """Count resumes for a job grouped by pass_fail status, including dynamic cross-matches."""
    # 1. Native Resumes - Get unique per-job individuals
    native_subq = (
        select(
            func.coalesce(Candidate.email, func.cast(Candidate.id, Text)).label("unique_id"),
            Resume.pass_fail
        )
        .join(Resume, Resume.candidate_id == Candidate.id)
        .where(Candidate.applied_job_id == job_id)
        .distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text)))
        .order_by(func.coalesce(Candidate.email, func.cast(Candidate.id, Text)), Resume.uploaded_at.desc())
        .subquery()
    )
    
    # 2. Cross-matches - Get unique per-job individuals
    cross_subq = (
        select(
            func.coalesce(Candidate.email, func.cast(Candidate.id, Text)).label("unique_id"),
            CrossJobMatch.match_score
        )
        .join(CrossJobMatch, CrossJobMatch.candidate_id == Candidate.id)
        .where(CrossJobMatch.matched_job_id == job_id)
        .distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text)))
        .order_by(func.coalesce(Candidate.email, func.cast(Candidate.id, Text)), CrossJobMatch.created_at.desc())
        .subquery()
    )

    job = await db.get(Job, job_id)
    threshold = float(job.passing_threshold) if job and job.passing_threshold else 70.0

    # Combine results: prioritization (Native > Cross)
    native_res = await db.execute(select(native_subq.c.unique_id, native_subq.c.pass_fail))
    cross_res = await db.execute(select(cross_subq.c.unique_id, cross_subq.c.match_score))
    
    counts = {"passed": 0, "failed": 0, "pending": 0}
    processed_ids = set()
    
    for uid, pf in native_res.all():
        processed_ids.add(uid)
        counts[pf if pf in counts else "pending"] += 1
        
    for uid, score in cross_res.all():
        if uid in processed_ids:
            continue
        
        s = float(score) if score is not None else 0.0
        pf = "passed" if s >= threshold else "failed"
        counts[pf] += 1

    return {
        "job_id": job_id,
        "passed_count": counts["passed"],
        "failed_count": counts["failed"],
        "pending_count": counts["pending"],
    }


async def get_global_screening_summary_impl(
    db: AsyncSession,
) -> dict[str, int]:
    """Global unique candidate screening status summary."""
    # 1. Native status per unique person
    native_stmt = (
        select(
            func.coalesce(Candidate.email, func.cast(Candidate.id, Text)).label("unique_id"),
            Resume.pass_fail
        )
        .join(Resume, Resume.candidate_id == Candidate.id)
        .distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text)))
        .order_by(
            func.coalesce(Candidate.email, func.cast(Candidate.id, Text)),
            case((Resume.pass_fail == "passed", 0), (Resume.pass_fail == "pending", 1), else_=2)
        )
    )
    
    # 2. Cross-match status per unique person
    cross_stmt = (
        select(
            func.coalesce(Candidate.email, func.cast(Candidate.id, Text)).label("unique_id"),
            case((CrossJobMatch.match_score >= 70.0, "passed"), else_="failed").label("pass_fail")
        )
        .join(CrossJobMatch, CrossJobMatch.candidate_id == Candidate.id)
        .distinct(func.coalesce(Candidate.email, func.cast(Candidate.id, Text)))
        .order_by(
            func.coalesce(Candidate.email, func.cast(Candidate.id, Text)),
            case((CrossJobMatch.match_score >= 70.0, 0), else_=1)
        )
    )

    native_res = await db.execute(native_stmt)
    cross_res = await db.execute(cross_stmt)
    
    counts = {"passed": 0, "failed": 0, "pending": 0}
    processed_ids = set()
    
    for uid, pf in native_res.all():
        processed_ids.add(uid)
        counts[pf if pf in counts else "pending"] += 1
        
    for uid, pf in cross_res.all():
        if uid in processed_ids:
            continue
        counts[pf] += 1

    return {
        "passed": counts["passed"],
        "failed": counts["failed"],
        "pending": counts["pending"],
    }


async def get_global_decision_summary_impl(db: AsyncSession) -> dict[str, int]:
    """Global count of latest decisions for all candidates."""
    summary = await get_decision_summary_impl(db)
    return {
        "total_candidates": summary.total_candidates,
        "passed_count": summary.passed_count,
        "failed_count": summary.failed_count,
        "maybe_count": summary.maybe_count,
        "undecided_count": summary.undecided_count,
    }
