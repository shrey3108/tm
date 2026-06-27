"""
Associate review form endpoints (token-based, NO AUTH required).

These endpoints serve an HTML form that an associate opens via a unique link
contained in their notification email. The link contains a ``review_token``
(UUID) which maps to a single ``AssociateEvaluation`` record.

Flow:
    1. Associate clicks link → ``GET /associate-reviews/{token}`` serves the HTML form.
    2. Associate fills marks per question and submits → ``POST /associate-reviews/{token}/submit``.
    3. Marks, total, result and submitted_at are persisted; a thank-you page is returned.
"""

from __future__ import annotations

import html
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.v1.core.config import settings
from app.v1.db.models.associate_evaluations import AssociateEvaluation
from app.v1.db.models.candidate_test_paper import CandidateTestPaper
from app.v1.db.models.jobs import Job
from app.v1.db.session import get_db

router = APIRouter(prefix="/associate-reviews", tags=["associate-reviews"])

# Passing threshold: an associate's review is considered "pass" if the total
# awarded marks are at least this fraction of the max total marks.
PASSING_THRESHOLD = 0.5


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_all_items(test_paper: CandidateTestPaper) -> list[dict]:
    """Return a normalized list of ALL gradable items (questions, MCQs, tasks).

    Each returned dict has:
        - item_type: "question" | "mcq" | "task"
        - question_text: display text for the item
        - max_marks: float or None
        - skill_ids: list[str] | None  (skill UUIDs as strings, for weighted marks)

    ``test_paper.questions`` stores serialized ``QuestionItem`` dicts
    (keys: question, marks, skill_ids). ``test_paper.mcqs`` stores ``MCQItem``
    dicts (keys: question, options, answer, marks, skill_ids).
    ``test_paper.project_task`` stores ``TaskItem`` dicts (keys:
    task/instructions/title/description, tasks (list of SubTask with
    name/description/marks), skill_ids).
    """
    items: list[dict] = []

    # --- Questions ---
    for idx, q in enumerate(test_paper.questions or []):
        if isinstance(q, dict):
            question_text = q.get("question") or f"Question {idx + 1}"
            max_marks = q.get("marks")
            skill_ids = q.get("skill_ids")
        elif isinstance(q, str):
            question_text = q
            max_marks = None
            skill_ids = None
        else:
            question_text = f"Question {idx + 1}"
            max_marks = None
            skill_ids = None
        items.append({
            "item_type": "question",
            "question_text": str(question_text),
            "max_marks": float(max_marks) if max_marks is not None else None,
            "skill_ids": list(skill_ids) if skill_ids else None,
        })

    # --- MCQs ---
    for idx, m in enumerate(test_paper.mcqs or []):
        if isinstance(m, dict):
            question_text = m.get("question") or f"MCQ {idx + 1}"
            options = m.get("options") or []
            max_marks = m.get("marks")
            skill_ids = m.get("skill_ids")
            # Build display text with options
            opts_html = ""
            if options:
                opt_lines = []
                for oi, opt in enumerate(options):
                    opt_lines.append(f"  {chr(65 + oi)}. {opt}")
                opts_html = "\n" + "\n".join(opt_lines)
            display_text = f"{question_text}{opts_html}"
        else:
            display_text = str(m)
            max_marks = None
            skill_ids = None
        items.append({
            "item_type": "mcq",
            "question_text": display_text,
            "max_marks": float(max_marks) if max_marks is not None else None,
            "skill_ids": list(skill_ids) if skill_ids else None,
        })

    # --- Project Tasks ---
    for idx, t in enumerate(test_paper.project_task or []):
        if isinstance(t, dict):
            # New format: title/description + tasks (sub-tasks)
            sub_tasks = t.get("tasks") or []
            # skill_ids live on the parent TaskItem; sub-tasks inherit them.
            parent_skill_ids = t.get("skill_ids")
            if sub_tasks:
                # Each sub-task gets its own mark input
                for si, st in enumerate(sub_tasks):
                    if isinstance(st, dict):
                        st_name = st.get("name") or f"Sub-task {si + 1}"
                        st_desc = st.get("description") or ""
                        st_marks = st.get("marks")
                        title_prefix = t.get("title") or t.get("task") or f"Project Task {idx + 1}"
                        display = f"[{title_prefix}] {st_name}"
                        if st_desc:
                            display += f"\n{st_desc}"
                        items.append({
                            "item_type": "task",
                            "question_text": display,
                            "max_marks": float(st_marks) if st_marks is not None else None,
                            "skill_ids": list(parent_skill_ids) if parent_skill_ids else None,
                        })
            else:
                # Old format: single task with marks
                task_text = t.get("task") or t.get("title") or f"Project Task {idx + 1}"
                instructions = t.get("instructions") or t.get("description") or ""
                max_marks = t.get("marks")
                display = task_text
                if instructions:
                    display += f"\n{instructions}"
                items.append({
                    "item_type": "task",
                    "question_text": display,
                    "max_marks": float(max_marks) if max_marks is not None else None,
                    "skill_ids": list(parent_skill_ids) if parent_skill_ids else None,
                })
        elif isinstance(t, str):
            items.append({
                "item_type": "task",
                "question_text": t,
                "max_marks": None,
                "skill_ids": None,
            })

    return items


async def _load_evaluation(db: AsyncSession, token: uuid.UUID) -> AssociateEvaluation:
    """Fetch the AssociateEvaluation by review_token or raise 404.

    Eagerly loads ALL relationships accessed by the form endpoints
    (test_paper, candidate, job + nested department/position,
    candidate_stage, associate) to avoid lazy-load errors in async
    context (MissingGreenlet).
    """
    result = await db.execute(
        select(AssociateEvaluation)
        .options(
            selectinload(AssociateEvaluation.test_paper),
            selectinload(AssociateEvaluation.candidate),
            selectinload(AssociateEvaluation.candidate_stage),
            selectinload(AssociateEvaluation.associate),
            selectinload(AssociateEvaluation.job).options(
                selectinload(Job.department),
                selectinload(Job.position),
            ),
        )
        .where(AssociateEvaluation.review_token == token)
    )
    evaluation = result.scalar_one_or_none()
    if evaluation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired review link.",
        )
    return evaluation


def _resolve_job_info(job: Optional[Job]) -> tuple[str, str, str]:
    """Return (job_title, department_name, position_name) from a Job instance."""
    job_title = ""
    department_name = "Department"
    position_name = "Position"
    if job:
        job_title = job.title or ""
        if job.department:
            department_name = job.department.name or "Department"
        if job.position:
            position_name = job.position.name or "Position"
    return job_title, department_name, position_name


def _candidate_full_name(candidate) -> str:
    return f"{candidate.first_name or 'Candidate'} {candidate.last_name or ''}".strip()


# ---------------------------------------------------------------------------
# 1. GET — Serve the HTML review form
# ---------------------------------------------------------------------------

@router.get("/{token}", response_class=HTMLResponse)
async def serve_review_form(token: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Serve the HTML review form for the given review token (no auth)."""
    evaluation = await _load_evaluation(db, token)

    # Already submitted → show a "already submitted" page.
    if evaluation.status == "submitted":
        return HTMLResponse(
            content=_already_submitted_html(),
            status_code=status.HTTP_200_OK,
        )

    test_paper = evaluation.test_paper
    if test_paper is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The test paper for this review could no longer be found.",
        )

    items = _parse_all_items(test_paper)
    candidate = evaluation.candidate
    job_title, department_name, position_name = _resolve_job_info(evaluation.job)
    candidate_full_name = _candidate_full_name(candidate) if candidate else "Candidate"

    # Resolve the candidate's GitHub URL from the stage evaluation_data.
    github_url = ""
    stage = evaluation.candidate_stage
    if stage and stage.evaluation_data:
        github_url = stage.evaluation_data.get("github_url") or ""

    work_drive_link = "https://www.augustinfotech.com/"
    # The router is mounted under /api/v1, so the submit URL must include it.
    submit_url = f"{settings.APP_BASE_URL.rstrip('/')}/api/v1/associate-reviews/{token}/submit"

    return HTMLResponse(content=_render_form_html(
        associate_name=evaluation.associate.name if evaluation.associate else "Reviewer",
        candidate_full_name=candidate_full_name,
        job_title=job_title,
        department_name=department_name,
        position_name=position_name,
        github_url=github_url,
        work_drive_link=work_drive_link,
        items=items,
        submit_url=submit_url,
    ))


# ---------------------------------------------------------------------------
# 2. POST — Process the submitted marks
# ---------------------------------------------------------------------------

@router.post("/{token}/submit", response_class=HTMLResponse)
async def submit_review_form(
    token: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Process the submitted marks form (no auth)."""
    evaluation = await _load_evaluation(db, token)

    if evaluation.status == "submitted":
        return HTMLResponse(
            content=_already_submitted_html(),
            status_code=status.HTTP_200_OK,
        )

    test_paper = evaluation.test_paper
    if test_paper is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The test paper for this review could no longer be found.",
        )

    items = _parse_all_items(test_paper)
    form = await request.form()

    # Collect awarded marks per item, validating against max marks.
    marks_list: list[dict] = []
    total_awarded = 0.0
    total_max = 0.0

    for idx, it in enumerate(items):
        field_name = f"marks_{idx}"
        raw_value = form.get(field_name, "")
        max_marks = it["max_marks"]

        awarded: Optional[float] = None
        try:
            if raw_value is not None and str(raw_value).strip() != "":
                awarded = float(str(raw_value).strip())
                if awarded < 0:
                    awarded = 0.0
                if max_marks is not None and awarded > max_marks:
                    awarded = max_marks
        except (ValueError, TypeError):
            awarded = None

        marks_list.append(
            {
                "item_type": it.get("item_type", "question"),
                "question_text": it["question_text"],
                "max_marks": max_marks,
                "awarded_marks": awarded,
                # Persist skill_ids (as strings) so the GET endpoint can
                # compute skill-weighted marks at read time.
                "skill_ids": it.get("skill_ids"),
            }
        )
        if awarded is not None:
            total_awarded += awarded
        if max_marks is not None:
            total_max += max_marks

    # Determine pass/fail result (only if we have a meaningful max total).
    result: Optional[str] = None
    if total_max > 0:
        result = "pass" if (total_awarded / total_max) >= PASSING_THRESHOLD else "fail"

    # Persist the submission.
    evaluation.marks = marks_list
    evaluation.total_marks = round(total_awarded, 2)
    evaluation.max_total_marks = round(total_max, 2)
    evaluation.result = result
    evaluation.submitted_at = datetime.now(timezone.utc)
    evaluation.status = "submitted"
    await db.commit()

    return HTMLResponse(content=_thank_you_html(
        total_awarded=round(total_awarded, 2),
        total_max=round(total_max, 2),
        result=result,
    ))


# ---------------------------------------------------------------------------
# HTML templates
# ---------------------------------------------------------------------------

def _render_form_html(
    associate_name: str,
    candidate_full_name: str,
    job_title: str,
    department_name: str,
    position_name: str,
    github_url: str,
    work_drive_link: str,
    items: list[dict],
    submit_url: str,
) -> str:
    """Render the review form HTML page.

    ``items`` is a normalized list of gradable items (questions, MCQs, tasks)
    produced by :func:`_parse_all_items`. Each item dict has:
        - item_type: "question" | "mcq" | "task"
        - question_text: display text (may contain newlines for options/desc)
        - max_marks: float or None
    """
    # Group items by type so we can render section headers.
    type_titles = {
        "question": "Questions",
        "mcq": "Multiple Choice Questions",
        "task": "Project Tasks",
    }
    type_order = ["question", "mcq", "task"]

    # Build sections HTML.
    sections_html_parts: list[str] = []
    for item_type in type_order:
        type_items = [it for it in items if it.get("item_type") == item_type]
        if not type_items:
            continue
        section_title = type_titles[item_type]
        rows: list[str] = []
        for idx, it in enumerate(type_items):
            # Use the global index across ALL items so the form field name
            # matches the order in ``items`` (which submit_review_form iterates).
            global_idx = items.index(it)
            raw_text = it["question_text"]
            # Escape each line, then join with <br> to preserve newlines.
            escaped_lines = [html.escape(line) for line in raw_text.split("\n")]
            display_html = "<br>".join(escaped_lines)
            max_marks = it["max_marks"]
            max_label = f" / {max_marks:g}" if max_marks is not None else ""
            rows.append(f"""
            <div class="question-row">
              <div class="question-text">{idx + 1}. {display_html}</div>
              <div class="mark-input">
                <input type="number" name="marks_{global_idx}" min="0"
                       {f'max="{max_marks:g}"' if max_marks is not None else ''}
                       step="0.5" placeholder="0" />
                <span class="max-label">{max_label}</span>
              </div>
            </div>""")
        sections_html_parts.append(f"""
        <div class="questions-section">
          <div class="questions-title">{html.escape(section_title)} — Enter Marks Awarded</div>
          {chr(10).join(rows)}
        </div>""")

    items_html = "\n".join(sections_html_parts)
    github_box = ""
    if github_url:
        github_box = f"""
            <div class="info-box github-box">
              <div class="box-title">Candidate GitHub Repository:</div>
              <a href="{html.escape(github_url)}" target="_blank" class="link">{html.escape(github_url)}</a>
            </div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Associate Review Form</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background-color: #f4f6f9;
      color: #333;
      padding: 20px;
    }}
    .container {{
      max-width: 720px;
      margin: 20px auto;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      overflow: hidden;
      border: 1px solid #eef2f6;
    }}
    .header {{
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      padding: 28px;
      text-align: center;
      color: #fff;
    }}
    .header h1 {{ font-size: 22px; font-weight: 700; }}
    .content {{ padding: 30px; }}
    .greeting {{ font-size: 17px; font-weight: 600; margin-bottom: 8px; color: #111827; }}
    .subtext {{ font-size: 14px; color: #6b7280; margin-bottom: 24px; }}
    .info-box {{
      border-radius: 8px;
      padding: 18px;
      margin-bottom: 20px;
    }}
    .candidate-box {{
      background: #f9fafb;
      border-left: 4px solid #3b82f6;
    }}
    .github-box {{
      background: #eff6ff;
      border-left: 4px solid #2563eb;
    }}
    .work-drive-box {{
      background: #ecfdf5;
      border-left: 4px solid #10b981;
    }}
    .box-title {{ font-weight: 600; color: #1f2937; margin-bottom: 8px; font-size: 14px; }}
    .info-row {{ display: flex; margin-bottom: 8px; font-size: 14px; }}
    .info-label {{ font-weight: 600; color: #1f2937; min-width: 150px; }}
    .info-value {{ color: #4b5563; flex: 1; }}
    .link {{ color: #2563eb; text-decoration: underline; word-break: break-all; font-size: 14px; }}
    .questions-section {{ margin-top: 10px; }}
    .questions-title {{
      font-size: 16px; font-weight: 600; color: #111827;
      margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #eef2f6;
    }}
    .question-row {{
      display: flex; align-items: flex-start; justify-content: space-between;
      padding: 14px 0; border-bottom: 1px solid #f3f4f6; gap: 16px;
    }}
    .question-text {{
      flex: 1; min-width: 0; font-size: 14px; line-height: 1.6; color: #374151;
      word-break: break-word; overflow-wrap: break-word; white-space: normal;
    }}
    .mark-input {{ display: flex; align-items: center; gap: 6px; flex-shrink: 0; padding-top: 2px; }}
    .mark-input input {{
      width: 70px; padding: 8px 10px; border: 1px solid #d1d5db;
      border-radius: 6px; font-size: 14px; text-align: center;
    }}
    .mark-input input:focus {{ outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }}
    .max-label {{ font-size: 13px; color: #6b7280; min-width: 30px; }}
    .submit-row {{ margin-top: 28px; text-align: center; }}
    .submit-btn {{
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: #fff; border: none; padding: 14px 40px; border-radius: 8px;
      font-size: 16px; font-weight: 600; cursor: pointer;
    }}
    .submit-btn:hover {{ opacity: 0.9; }}
    .footer {{
      background: #f9fafb; padding: 16px 30px; text-align: center;
      font-size: 12px; color: #9ca3af; border-top: 1px solid #eef2f6;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Candidate Evaluation Review</h1>
    </div>
    <div class="content">
      <div class="greeting">Hello {html.escape(associate_name)},</div>
      <div class="subtext">
        Please review the candidate below and enter marks for each question, then click Submit.
      </div>

      <div class="info-box candidate-box">
        <div class="box-title">Candidate Details</div>
        <div class="info-row">
          <div class="info-label">Candidate Name:</div>
          <div class="info-value">{html.escape(candidate_full_name)}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Job Role:</div>
          <div class="info-value">{html.escape(job_title) or 'N/A'}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Department:</div>
          <div class="info-value">{html.escape(department_name)}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Position:</div>
          <div class="info-value">{html.escape(position_name)}</div>
        </div>
      </div>

      {github_box}

      <div class="info-box work-drive-box">
        <div class="box-title">Work Drive Link:</div>
        <a href="{html.escape(work_drive_link)}" target="_blank" class="link" style="color:#10b981;">{html.escape(work_drive_link)}</a>
      </div>

      <form method="POST" action="{html.escape(submit_url)}">
        {items_html}
        <div class="submit-row">
          <button type="submit" class="submit-btn">Submit Evaluation</button>
        </div>
      </form>
    </div>
    <div class="footer">
      August Infotech &mdash; www.augustinfotech.com
    </div>
  </div>
</body>
</html>"""


def _thank_you_html(total_awarded: float, total_max: float, result: Optional[str]) -> str:
    """Render the thank-you / confirmation page after submission."""
    result_label = "N/A"
    result_color = "#6b7280"
    if result == "pass":
        result_label = "PASS"
        result_color = "#10b981"
    elif result == "fail":
        result_label = "FAIL"
        result_color = "#ef4444"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Review Submitted</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background-color: #f4f6f9; color: #333; padding: 20px;
    }}
    .container {{
      max-width: 520px; margin: 60px auto; background: #fff;
      border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      overflow: hidden; border: 1px solid #eef2f6; text-align: center;
    }}
    .header {{
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      padding: 40px 30px; color: #fff;
    }}
    .header .check {{ font-size: 48px; margin-bottom: 12px; }}
    .header h1 {{ font-size: 22px; font-weight: 700; }}
    .content {{ padding: 36px 30px; }}
    .message {{ font-size: 15px; color: #4b5563; line-height: 1.6; margin-bottom: 24px; }}
    .score-box {{
      background: #f9fafb; border-radius: 8px; padding: 20px;
      margin-bottom: 20px; border-left: 4px solid #3b82f6;
    }}
    .score-row {{ display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 15px; }}
    .score-label {{ font-weight: 600; color: #1f2937; }}
    .score-value {{ color: #4b5563; }}
    .result-badge {{
      display: inline-block; padding: 8px 24px; border-radius: 20px;
      font-weight: 700; font-size: 16px; color: #fff;
      background-color: {result_color};
    }}
    .footer {{
      background: #f9fafb; padding: 16px 30px; text-align: center;
      font-size: 12px; color: #9ca3af; border-top: 1px solid #eef2f6;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="check">&#10004;</div>
      <h1>Thank You!</h1>
    </div>
    <div class="content">
      <div class="message">
        Your evaluation has been submitted successfully. You may now close this window.
      </div>
      <div class="score-box">
        <div class="score-row">
          <span class="score-label">Total Marks:</span>
          <span class="score-value">{total_awarded:g} / {total_max:g}</span>
        </div>
        <div class="score-row">
          <span class="score-label">Result:</span>
          <span class="result-badge">{result_label}</span>
        </div>
      </div>
    </div>
    <div class="footer">
      August Infotech &mdash; www.augustinfotech.com
    </div>
  </div>
</body>
</html>"""


def _already_submitted_html() -> str:
    """Render the 'already submitted' page."""
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Already Submitted</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background-color: #f4f6f9; color: #333; padding: 20px;
    }
    .container {
      max-width: 520px; margin: 60px auto; background: #fff;
      border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      overflow: hidden; border: 1px solid #eef2f6; text-align: center;
    }
    .header {
      background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
      padding: 40px 30px; color: #fff;
    }
    .header .icon { font-size: 48px; margin-bottom: 12px; }
    .header h1 { font-size: 22px; font-weight: 700; }
    .content { padding: 36px 30px; }
    .message { font-size: 15px; color: #4b5563; line-height: 1.6; }
    .footer {
      background: #f9fafb; padding: 16px 30px; text-align: center;
      font-size: 12px; color: #9ca3af; border-top: 1px solid #eef2f6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">&#8505;</div>
      <h1>Already Submitted</h1>
    </div>
    <div class="content">
      <div class="message">
        This review form has already been submitted. No further changes can be made.
        You may now close this window.
      </div>
    </div>
    <div class="footer">
      August Infotech &mdash; www.augustinfotech.com
    </div>
  </div>
</body>
</html>"""
