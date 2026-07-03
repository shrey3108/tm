import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from github_code_evaluator.app.v1.core.security import get_current_user
from github_code_evaluator.app.v1.db.models.evaluation import Evaluation
from github_code_evaluator.app.v1.db.models.override_log import ReviewerOverrideLog
from github_code_evaluator.app.v1.db.models.report import EvaluationReport
from github_code_evaluator.app.v1.db.models.repository import Repository
from github_code_evaluator.app.v1.db.models.score import EvaluationScore
from github_code_evaluator.app.v1.db.models.security_result import SecurityResult
from github_code_evaluator.app.v1.db.session import get_db
from github_code_evaluator.app.v1.schemas.base import MessageResponse
from github_code_evaluator.app.v1.schemas.evaluation import ReportResponse, ReviewerOverrideRequest, ScoreDetail, SecurityFinding
from github_code_evaluator.app.v1.services.cache import cache_service
from github_code_evaluator.app.v1.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{evaluation_id}/report", response_model=ReportResponse)
async def get_evaluation_report(
    evaluation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Retrieve the full structured JSON report for a completed evaluation."""
    # Try to fetch from Redis cache
    cache_key = f"evaluation:report:{evaluation_id}"
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        try:
            return ReportResponse.model_validate(cached_data)
        except Exception as e:
            logger.warning(f"Failed to validate cached report schema for {evaluation_id}: {e}")

    # 1. Fetch evaluation
    result = await db.execute(select(Evaluation).where(Evaluation.evaluation_id == evaluation_id))
    evaluation = result.scalar_one_or_none()

    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation job not found",
        )

    # 2. Fetch Repository
    result = await db.execute(
        select(Repository).where(Repository.repository_id == evaluation.repository_id)
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated repository not found",
        )

    # 3. Fetch Scores
    result = await db.execute(
        select(EvaluationScore).where(EvaluationScore.evaluation_id == evaluation_id)
    )
    scores = result.scalars().all()
    scores_dict = {
        s.category: ScoreDetail(
            score=float(s.score),
            weight=float(s.weight),
            weighted_score=float(s.weighted_score),
        )
        for s in scores
    }

    # 4. Fetch Report Narrative
    result = await db.execute(
        select(EvaluationReport).where(EvaluationReport.evaluation_id == evaluation_id)
    )
    report = result.scalar_one_or_none()

    jd_alignment_report = report.jd_alignment_report if report else ""
    project_alignment_report = report.project_alignment_report if report else ""

    strengths = report.strengths if report and report.strengths else []
    weaknesses = report.weaknesses if report and report.weaknesses else []
    security_risks = report.security_risks if report and report.security_risks else []
    arch_review = report.architecture_review if report else ""
    code_review = report.code_quality_review if report else ""
    seniority = report.seniority_estimate if report else ""
    questions = report.interview_questions if report and report.interview_questions else []

    # 5. Fetch Security results
    result = await db.execute(
        select(SecurityResult).where(SecurityResult.evaluation_id == evaluation_id)
    )
    sec_results = result.scalars().all()
    findings = []
    for s_res in sec_results:
        finding_list = s_res.findings if isinstance(s_res.findings, list) else []
        for f in finding_list:
            findings.append(
                SecurityFinding(
                    file=f.get("file", ""),
                    line=f.get("line"),
                    finding=f.get("finding", ""),
                    severity=f.get("severity", "MEDIUM"),
                )
            )

    jd_alignment = report.jd_alignment if report else None
    project_alignment = report.project_alignment if report else None

    # Inject default structures if they are old format or missing elements
    if jd_alignment and isinstance(jd_alignment, dict):
        if "jd_skills" not in jd_alignment:
            jd_alignment["jd_skills"] = repo.jd_skills
        if "jd_alignment_report" not in jd_alignment:
            jd_alignment["jd_alignment_report"] = jd_alignment_report or jd_alignment.get("alignment_review", "")
        if "overall_score" not in jd_alignment:
            jd_scores = jd_alignment.get("scores", {})
            if jd_scores:
                total = 0.0
                for cat, val in jd_scores.items():
                    if isinstance(val, dict):
                        total += val.get("weighted_score", 0.0)
                    elif hasattr(val, "weighted_score"):
                        total += val.weighted_score
                jd_alignment["overall_score"] = round(total, 1)

    if project_alignment and isinstance(project_alignment, dict):
        if "project_required_skills" not in project_alignment:
            project_alignment["project_required_skills"] = repo.project_required_skills
        if "project_alignment_report" not in project_alignment:
            project_alignment["project_alignment_report"] = project_alignment_report or project_alignment.get("alignment_review", "")
        if "overall_score" not in project_alignment:
            proj_scores = project_alignment.get("scores", {})
            if proj_scores:
                total = 0.0
                for cat, val in proj_scores.items():
                    if isinstance(val, dict):
                        total += val.get("weighted_score", 0.0)
                    elif hasattr(val, "weighted_score"):
                        total += val.weighted_score
                project_alignment["overall_score"] = round(total, 1)

    error_msg = None
    if evaluation.status == "cloning_error":
        error_msg = "Evaluation stopped: The GitHub repository is private or inaccessible."

    arch_score = max(0.0, float(scores_dict.get("architecture").score) if "architecture" in scores_dict else (float(report.architecture_score) if report and report.architecture_score is not None else 0.0))
    code_score = max(0.0, float(scores_dict.get("code_quality").score) if "code_quality" in scores_dict else (float(report.code_quality_score) if report and report.code_quality_score is not None else 0.0))
    sec_score = max(0.0, float(scores_dict.get("security").score) if "security" in scores_dict else (float(report.security_score) if report and report.security_score is not None else 0.0))
    extra_score = max(0.0, float(report.extraordinary_score) if report and report.extraordinary_score is not None else 0.0)

    response_payload = ReportResponse(
        evaluation_id=evaluation.evaluation_id,
        repository_id=repo.repository_id,
        github_url=repo.github_url,
        cloned_at=repo.cloned_at,
        stack=repo.stack,
        status=evaluation.status,
        overall_score=float(evaluation.overall_score) if evaluation.overall_score is not None else None,
        recommendation=evaluation.recommendation,
        llm_model=evaluation.llm_model,
        prompt_version=evaluation.prompt_version,
        error_message=error_msg,
        created_at=evaluation.created_at,
        updated_at=evaluation.updated_at,
        seniority_estimate=seniority,
        security_findings=findings,
        jd_skills=repo.jd_skills,
        project_required_skills=repo.project_required_skills,
        jd_alignment_report=jd_alignment_report,
        project_alignment_report=project_alignment_report,
        jd_alignment=jd_alignment,
        project_alignment=project_alignment,
        scores={k: float(v.score) for k, v in scores_dict.items()},
        security_risks=security_risks,
        architecture_review=arch_review,
        code_quality_review=code_review,
        extraordinary_points=report.extraordinary_points if report and report.extraordinary_points else [],
        architecture_score=arch_score,
        code_quality_score=code_score,
        security_score=sec_score,
        extraordinary_score=extra_score,
    )

    # Cache response in Redis
    await cache_service.set(cache_key, response_payload.model_dump(), expire_seconds=settings.REDIS_CACHE_TTL)

    return response_payload


@router.post("/{evaluation_id}/override", response_model=MessageResponse)
async def override_evaluation_score(
    evaluation_id: UUID,
    payload: ReviewerOverrideRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Override a category score for an evaluation.

    Recalculates the overall score and saves an audit log entry.
    """
    # Restrict to Reviewers or Admins
    if current_user.get("role") not in ("reviewer", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only reviewers and admin users can override scores",
        )

    # 1. Fetch evaluation
    result = await db.execute(select(Evaluation).where(Evaluation.evaluation_id == evaluation_id))
    evaluation = result.scalar_one_or_none()

    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation job not found",
        )

    # 2. Fetch target category score
    result = await db.execute(
        select(EvaluationScore)
        .where(EvaluationScore.evaluation_id == evaluation_id)
        .where(EvaluationScore.category == payload.category.lower())
    )
    score_entry = result.scalar_one_or_none()

    if not score_entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category '{payload.category}' not found for this evaluation",
        )

    old_score = float(score_entry.score)
    new_score = float(payload.score)

    # 3. Update category score and recalculate weighted score
    score_entry.score = new_score
    score_entry.weighted_score = new_score * float(score_entry.weight)

    # 4. Fetch all score entries to compute new overall score
    result = await db.execute(
        select(EvaluationScore).where(EvaluationScore.evaluation_id == evaluation_id)
    )
    all_scores = result.scalars().all()
    total_weighted = sum(float(s.weighted_score) for s in all_scores)
    total_weight = sum(float(s.weight) for s in all_scores)

    new_overall_score = round(total_weighted / total_weight, 1) if total_weight > 0 else 0.0
    evaluation.overall_score = new_overall_score

    # 5. Log audit entry
    reviewer_username = current_user.get("sub", "unknown_reviewer")
    audit_log = ReviewerOverrideLog(
        evaluation_id=evaluation_id,
        category=payload.category,
        old_score=old_score,
        new_score=new_score,
        notes=payload.notes,
        reviewer_username=reviewer_username,
    )
    db.add(audit_log)

    await db.commit()

    # Invalidate cache for this evaluation report
    await cache_service.delete(f"evaluation:report:{evaluation_id}")

    logger.info(
        f"Reviewer '{reviewer_username}' overrode category '{payload.category}' from {old_score} to {new_score}. "
        f"New overall score: {new_overall_score}"
    )

    return MessageResponse(
        message=f"Category '{payload.category}' overridden successfully. New overall score: {new_overall_score}"
    )


@router.get("/{evaluation_id}/html", response_class=HTMLResponse)
async def get_evaluation_report_html(
    evaluation_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Render a stunning HSL/dark theme dashboard report directly from the API endpoints.

    Requires no auth headers for easy loading/sharing in web views.
    """
    # Fetch report data
    try:
        report_data = await get_evaluation_report(evaluation_id=evaluation_id, db=db, current_user={"sub": "system", "role": "admin"})
    except HTTPException as e:
        return f"<h3>Error: {e.detail}</h3>", e.status_code

    if report_data.status == "cloning_error":
        error_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Evaluation Stopped - Private Repository</title>
            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        </head>
        <body style="background: #090d16; margin: 0; padding: 20px; font-family: 'Outfit', 'Inter', sans-serif;">
            <div style="background: #0f172a; color: #e2e8f0; padding: 40px; border-radius: 16px; border: 1px solid #1e293b; max-width: 600px; margin: 80px auto; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <div style="font-size: 4rem; margin-bottom: 20px;">🔒</div>
                <h1 style="color: #f8fafc; font-size: 1.8rem; margin: 0 0 16px 0; font-weight: 700;">Evaluation Stopped</h1>
                <p style="color: #94a3b8; font-size: 1rem; line-height: 1.6; margin-bottom: 24px;">
                    The evaluation for repository <br>
                    <a href="{report_data.github_url}" target="_blank" style="color: #6366f1; text-decoration: none; font-weight: 500;">{report_data.github_url}</a> <br>
                    has stopped because the repository is <strong>private or inaccessible</strong>.
                </p>
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); padding: 16px; border-radius: 8px; color: #f87171; font-size: 0.9rem; margin-bottom: 24px;">
                    Action Required: Please verify that the repository is public, or grant necessary access permissions to allow cloning.
                </div>
                <p style="color: #64748b; font-size: 0.8rem; margin: 0;">
                    AIRA Talent • Status: CLONING_ERROR
                </p>
            </div>
        </body>
        </html>
        """
        return HTMLResponse(content=error_html)

    # Build HSL dashboard variables
    rec = report_data.recommendation or "Reject"
    rec_badge_style = ""
    if "proceed" in rec.lower():
        rec_badge_style = "background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);"
    else:
        rec_badge_style = "background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);"

    # Build seniority estimate badge if applicable
    seniority = report_data.seniority_estimate or "Mid-level"
    show_seniority = (
        seniority.strip().upper() not in ("N/A", "NA", "NONE", "")
        and "reject" not in rec.lower()
    )
    
    if show_seniority:
        seniority_badge_html = f"""
        <span style="flex: 1; text-align: center; padding: 6px 10px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; background: #334155; color: #cbd5e1; border: 1px solid #475569;">
            {seniority}
        </span>
        """
        flex_rec_width = "flex: 1.2;"
    else:
        seniority_badge_html = ""
        flex_rec_width = "flex: 1;"

    # Build badges for tech stack
    stack_sections_html = ""
    stack_data = report_data.stack or {}
    for cat_name, items in stack_data.items():
        if items:
            badges = "".join(
                [
                    f'<span style="background: rgba(99, 102, 241, 0.15); color: #818cf8; padding: 3px 8px; border-radius: 4px; font-size: 0.7rem; margin-right: 4px; margin-bottom: 4px; display: inline-block; font-weight: 500; border: 1px solid rgba(99, 102, 241, 0.3);">{item}</span>'
                    for item in items
                ]
            )
            stack_sections_html += f"""
            <div style="margin-bottom: 8px;">
                <strong style="font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; margin-right: 8px; display: inline-block; min-width: 140px;">{cat_name}:</strong>
                {badges}
            </div>
            """

    # Helper function to render each alignment block
    def render_alignment_block(title, icon, target_skills, alignment, is_jd=True):
        if not alignment:
            return f"""
            <div style="background: #1e293b; padding: 24px; border-radius: 16px; border: 1px solid #334155;">
                <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 1.25rem; color: #f1f5f9; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.4rem;">{icon}</span> {title}
                </h3>
                <p style="margin: 0; font-size: 0.95rem; color: #94a3b8;">No alignment data available.</p>
            </div>
            """

        skills_str = ", ".join(target_skills) if target_skills else "None specified"
        
        strengths = alignment.strengths if hasattr(alignment, "strengths") else alignment.get("strengths", [])
        weaknesses = alignment.weaknesses if hasattr(alignment, "weaknesses") else alignment.get("weaknesses", [])
        interview_questions = alignment.interview_questions if hasattr(alignment, "interview_questions") else alignment.get("interview_questions", [])
        alignment_review = alignment.alignment_review if hasattr(alignment, "alignment_review") else alignment.get("alignment_review", "")

        strengths_li = "".join([f"<li style='margin-bottom: 6px; display: flex; align-items: start; gap: 6px;'><span style='color: #34d399;'>✓</span> {s}</li>" for s in strengths])
        weaknesses_li = "".join([f"<li style='margin-bottom: 6px; display: flex; align-items: start; gap: 6px;'><span style='color: #fb7185;'>✗</span> {w}</li>" for w in weaknesses])
        questions_li = "".join([f"<li style='margin-bottom: 6px; display: flex; align-items: start; gap: 6px;'><span style='color: #818cf8;'>❓</span> {q}</li>" for q in interview_questions])

        # Category reviews config
        categories_config = [
            ("Correctness", "correctness", "correctness_review", "#3b82f6"),
            ("Code Quality", "code_quality", "code_quality_review", "#10b981"),
            ("Architecture", "architecture", "architecture_review", "#8b5cf6"),
            ("Security", "security", "security_review", "#f59e0b"),
            ("Performance", "performance", "performance_review", "#ec4899"),
            ("Documentation", "documentation", "documentation_review", "#64748b"),
        ]

        cat_reviews_html = ""
        alignment_scores = alignment.scores if hasattr(alignment, "scores") else alignment.get("scores", {})
        for label, score_key, review_key, color in categories_config:
            score_item = alignment_scores.get(score_key)
            if score_item:
                val = getattr(score_item, "score", 0.0) if not isinstance(score_item, dict) else score_item.get("score", 0.0)
            else:
                val = 0.0
            
            review_text = getattr(alignment, review_key, "") if hasattr(alignment, review_key) else alignment.get(review_key, "")
            review_text = review_text or "No detailed review provided for this category."

            cat_reviews_html += f"""
            <div style="margin-bottom: 12px; padding: 12px; background: rgba(255, 255, 255, 0.02); border-left: 3px solid {color}; border-radius: 0 8px 8px 0; border: 1px solid rgba(255, 255, 255, 0.05); border-left-width: 3px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <strong style="font-size: 0.85rem; color: #f1f5f9; font-weight: 600;">{label}</strong>
                    <span style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; color: {color}; border: 1px solid rgba(255,255,255,0.1); font-weight: bold;">Score: {val}/5</span>
                </div>
                <p style="margin: 0; font-size: 0.85rem; color: #cbd5e1; line-height: 1.45;">
                    {review_text}
                </p>
            </div>
            """
            # fmt: on

        overall_score = getattr(alignment, "overall_score", 0.0) if hasattr(alignment, "overall_score") else alignment.get("overall_score", 0.0)
        overall_color = "#10b981" if overall_score >= 3.5 else ("#f59e0b" if overall_score >= 2.5 else "#ef4444")

        decision = getattr(alignment, "decision", "") if hasattr(alignment, "decision") else alignment.get("decision", "")
        decision_badge = ""
        if decision:
            dec_color = "#34d399" if "proceed" in decision.lower() else "#f87171"
            dec_bg = "rgba(16, 185, 129, 0.15)" if "proceed" in decision.lower() else "rgba(239, 68, 68, 0.15)"
            dec_border = "rgba(16, 185, 129, 0.3)" if "proceed" in decision.lower() else "rgba(239, 68, 68, 0.3)"
            decision_badge = f'<span style="background: {dec_bg}; color: {dec_color}; border: 1px solid {dec_border}; padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">{decision}</span>'

        return f"""
        <div style="background: #1e293b; padding: 24px; border-radius: 16px; border: 1px solid #334155; display: flex; flex-direction: column; justify-content: space-between; height: 100%; box-sizing: border-box;">
            <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.25rem; color: #f1f5f9; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1.4rem;">{icon}</span> {title}
                        </h3>
                        <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 4px;">Target Skills: {skills_str}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        {decision_badge}
                        <span style="background: rgba(255, 255, 255, 0.05); color: {overall_color}; padding: 4px 12px; border-radius: 9999px; font-size: 0.8rem; font-weight: 700; border: 1px solid {overall_color}55;">
                            Overall Score: {overall_score}/5
                        </span>
                    </div>
                </div>
                
                <p style="margin: 0 0 20px 0; font-size: 0.9rem; color: #cbd5e1; line-height: 1.5; font-style: italic; background: rgba(255,255,255,0.01); padding: 12px; border-radius: 8px; border-left: 2px solid #475569;">
                    "{alignment_review or "No alignment review provided."}"
                </p>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                    <div style="background: rgba(16, 185, 129, 0.01); padding: 12px; border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.1);">
                        <strong style="font-size: 0.85rem; color: #34d399; display: block; margin-bottom: 6px;">Strengths:</strong>
                        <ul style="margin: 0; padding: 0; list-style-type: none; font-size: 0.82rem; color: #cbd5e1; line-height: 1.4;">
                            {strengths_li or "<li>No specific strengths identified.</li>"}
                        </ul>
                    </div>
                    <div style="background: rgba(239, 68, 68, 0.01); padding: 12px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.1);">
                        <strong style="font-size: 0.85rem; color: #fb7185; display: block; margin-bottom: 6px;">Gaps / Weaknesses:</strong>
                        <ul style="margin: 0; padding: 0; list-style-type: none; font-size: 0.82rem; color: #cbd5e1; line-height: 1.4;">
                            {weaknesses_li or "<li>No specific gaps identified.</li>"}
                        </ul>
                    </div>
                </div>
                
                <div style="margin-bottom: 24px; background: rgba(99, 102, 241, 0.01); padding: 12px; border-radius: 8px; border: 1px solid rgba(99, 102, 241, 0.1);">
                    <strong style="font-size: 0.85rem; color: #818cf8; display: block; margin-bottom: 6px;">Targeted Interview Questions:</strong>
                    <ul style="margin: 0; padding: 0; list-style-type: none; font-size: 0.82rem; color: #cbd5e1; line-height: 1.45;">
                        {questions_li or "<li>No interview questions generated.</li>"}
                    </ul>
                </div>
            </div>
            
            <div>
                <strong style="font-size: 0.9rem; color: #f1f5f9; display: block; margin-bottom: 12px; border-bottom: 1px solid #334155; padding-bottom: 6px; font-weight: 600;">Category-Specific Reviews:</strong>
                {cat_reviews_html}
            </div>
        </div>
        """



    jd_alignment_html = render_alignment_block(
        title="Job Description Alignment Review",
        icon="💼",
        target_skills=report_data.jd_skills or [],
        alignment=report_data.jd_alignment,
        is_jd=True
    )

    project_alignment_html = render_alignment_block(
        title="Project Requirements Alignment Review",
        icon="📁",
        target_skills=report_data.project_required_skills or [],
        alignment=report_data.project_alignment,
        is_jd=False
    )

    security_risks_li = "".join([f"<li style='margin-bottom: 6px;'>{r}</li>" for r in (report_data.security_risks or [])])
    if not security_risks_li:
        security_risks_li = "<li style='color: #94a3b8; list-style-type: none; margin-left: -20px;'>No global security risks identified.</li>"

    extraordinary_points_li = "".join([f"<li style='margin-bottom: 6px; display: flex; align-items: start; gap: 8px;'><span style='color: #10b981; font-weight: bold;'>★</span> <span>{p}</span></li>" for p in (report_data.extraordinary_points or [])])
    if not extraordinary_points_li:
        extraordinary_points_li = "<li style='color: #94a3b8; list-style-type: none; margin-left: -20px;'>No extraordinary points.</li>"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Candidate Evaluation Dashboard</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    </head>
    <body style="background: #090d16; margin: 0; padding: 20px;">
        <div style="font-family: 'Outfit', 'Inter', sans-serif; background: #0f172a; color: #e2e8f0; padding: 30px; border-radius: 16px; border: 1px solid #1e293b; max-width: 1200px; margin: 20px auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #1e293b; padding-bottom: 24px; margin-bottom: 24px; flex-wrap: wrap; gap: 15px;">
                <div style="flex: 1; min-width: 300px;">
                    <h1 style="margin: 0 0 8px 0; font-size: 1.8rem; color: #f8fafc; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 2.2rem; line-height: 1;">🔎</span> Candidate Repository Evaluation
                    </h1>
                    <p style="margin: 0 0 16px 0; font-size: 0.95rem; color: #94a3b8;">
                        Target URL: <a href="{report_data.github_url}" target="_blank" style="color: #6366f1; text-decoration: none; font-weight: 500;">{report_data.github_url}</a>
                    </p>
                    <div style="display: flex; flex-wrap: wrap;">
                        {stack_sections_html}
                    </div>
                </div>
                
                <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; min-width: 220px;">
                    <div style="background: #1e293b; padding: 12px 24px; border-radius: 12px; border: 1px solid #334155; text-align: center; margin-bottom: 12px; width: 100%; box-sizing: border-box;">
                        <div style="font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;">Overall Weighted Score</div>
                        <div style="font-size: 2.4rem; font-weight: 800; color: #f8fafc; line-height: 1;">
                            {report_data.overall_score} <span style="font-size: 1.2rem; color: #64748b; font-weight: 500;">/ 5</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; width: 100%;">
                        <span style="{flex_rec_width} text-align: center; padding: 6px 10px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; {rec_badge_style}">
                            {rec}
                        </span>
                        {seniority_badge_html}
                    </div>
                </div>
            </div>
            
            <!-- Global Technical Review & Risks -->
            <div style="background: #1e293b; padding: 24px; border-radius: 16px; border: 1px solid #334155; margin-bottom: 24px;">
                <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 1.15rem; color: #f1f5f9; border-bottom: 1px solid #334155; padding-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                    🛡️ Global Technical & Security Review
                </h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
                    <!-- Code Quality & Architecture -->
                    <div>
                        <div style="margin-bottom: 16px;">
                            <strong style="font-size: 0.9rem; color: #38bdf8; display: block; margin-bottom: 6px;">
                                📐 Architectural Review
                                <span style="font-size: 0.75rem; background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-left: 6px; border: 1px solid rgba(56, 189, 248, 0.3);">
                                    Score: {report_data.architecture_score or 0.0}/5
                                </span>
                            </strong>
                            <p style="margin: 0; font-size: 0.85rem; color: #cbd5e1; line-height: 1.5; font-style: italic; background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px; border-left: 2px solid #38bdf8;">
                                "{report_data.architecture_review or "No global architectural review provided."}"
                            </p>
                        </div>
                        <div>
                            <strong style="font-size: 0.9rem; color: #34d399; display: block; margin-bottom: 6px;">
                                ✨ Code Quality Review
                                <span style="font-size: 0.75rem; background: rgba(52, 211, 153, 0.15); color: #34d399; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-left: 6px; border: 1px solid rgba(52, 211, 153, 0.3);">
                                    Score: {report_data.code_quality_score or 0.0}/5
                                </span>
                            </strong>
                            <p style="margin: 0; font-size: 0.85rem; color: #cbd5e1; line-height: 1.5; font-style: italic; background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px; border-left: 2px solid #34d399;">
                                "{report_data.code_quality_review or "No global code quality review provided."}"
                            </p>
                        </div>
                    </div>
                    <!-- Security Risks List -->
                    <div style="background: rgba(239, 68, 68, 0.02); padding: 16px; border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.15);">
                        <strong style="font-size: 0.9rem; color: #f87171; display: block; margin-bottom: 10px;">
                            ⚠️ Identified Security Risks
                            <span style="font-size: 0.75rem; background: rgba(248, 113, 113, 0.15); color: #f87171; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-left: 6px; border: 1px solid rgba(248, 113, 113, 0.3);">
                                Score: {report_data.security_score or 0.0}/5
                            </span>
                        </strong>
                        <ul style="margin: 0; padding: 0 0 0 20px; font-size: 0.85rem; color: #cbd5e1; line-height: 1.5;">
                            {security_risks_li}
                        </ul>
                    </div>
                    <!-- Extraordinary Points List -->
                    <div style="background: rgba(16, 185, 129, 0.02); padding: 16px; border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.15);">
                        <strong style="font-size: 0.9rem; color: #34d399; display: block; margin-bottom: 10px;">
                            ⭐ Extraordinary Points
                            <span style="font-size: 0.75rem; background: rgba(52, 211, 153, 0.15); color: #34d399; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-left: 6px; border: 1px solid rgba(52, 211, 153, 0.3);">
                                Score: {report_data.extraordinary_score or 0.0}/5
                            </span>
                        </strong>
                        <ul style="margin: 0; padding: 0 0 0 20px; font-size: 0.85rem; color: #cbd5e1; line-height: 1.5; list-style-type: none;">
                            {extraordinary_points_li}
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Alignment Reviews Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(500px, 1fr)); gap: 24px;">
                {jd_alignment_html}
                {project_alignment_html}
            </div>
            
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)
