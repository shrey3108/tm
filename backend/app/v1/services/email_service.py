import os
import html
import smtplib
import uuid
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import asyncio
import logging
from typing import Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.v1.db.models.candidates import Candidate
from app.v1.db.models.candidate_test_paper import CandidateTestPaper
from app.v1.db.models.question_set_paper import QuestionSetPaper
from app.v1.core.config import settings
from app.v1.core.storage import resolve_storage_path
from app.v1.utils.pdf_generator import generate_candidate_task_pdf_file

logger = logging.getLogger(__name__)

def markdown_to_html(text: str) -> str:
    lines = text.split("\n")
    html_lines = []
    
    in_table = False
    table_headers = None
    table_rows = []
    
    in_list = False
    
    def render_table(headers, rows):
        if not headers and not rows:
            return ""
        tbl = '<table style="border-collapse: collapse; width: 100%; margin: 15px 0; font-size: 13px; font-family: inherit; border: 1px solid #e2e8f0;">'
        if headers:
            tbl += '<thead style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;"><tr>'
            for h in headers:
                tbl += f'<th style="padding: 10px 12px; font-weight: 600; color: #334155; border: 1px solid #e2e8f0; text-align: left;">{html.escape(h.strip())}</th>'
            tbl += '</tr></thead>'
        tbl += '<tbody>'
        for r in rows:
            tbl += '<tr style="border-bottom: 1px solid #e2e8f0;">'
            for cell in r:
                tbl += f'<td style="padding: 8px 12px; color: #475569; border: 1px solid #e2e8f0; text-align: left;">{html.escape(cell.strip())}</td>'
            tbl += '</tr>'
        tbl += '</tbody></table>'
        return tbl

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        # Check if it is a table row
        if stripped.startswith("|") and stripped.endswith("|"):
            if in_list:
                html_lines.append('</ul>')
                in_list = False
                
            cells = [c.strip() for c in line.split("|")]
            if len(cells) > 1 and cells[0] == "":
                cells = cells[1:]
            if len(cells) > 0 and cells[-1] == "":
                cells = cells[:-1]
                
            is_separator = all(all(char in "- :" for char in cell) for cell in cells) if cells else False
            
            if is_separator:
                i += 1
                continue
                
            if not in_table:
                in_table = True
                table_headers = cells
                table_rows = []
            else:
                table_rows.append(cells)
            i += 1
            continue
        else:
            if in_table:
                html_lines.append(render_table(table_headers, table_rows))
                in_table = False
                table_headers = None
                table_rows = []
                
        # Parse headers
        if stripped.startswith(("## ", "### ")):
            if in_list:
                html_lines.append('</ul>')
                in_list = False
                
            is_h2 = stripped.startswith("## ")
            header_text = stripped[3:] if is_h2 else stripped[4:]
            header_text = header_text.replace("**", "")
            
            if header_text.startswith("· "):
                header_text = header_text[2:]
                bullet_prefix = "· "
            else:
                bullet_prefix = ""
                
            font_size = "15px" if is_h2 else "13.5px"
            font_weight = "700" if is_h2 else "600"
            border_style = "border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;" if is_h2 else ""
            
            html_lines.append(f'<div style="font-weight: {font_weight}; font-size: {font_size}; color: #1e3a8a; margin-top: 15px; margin-bottom: 8px; {border_style}">{bullet_prefix}{html.escape(header_text)}</div>')
            
        elif stripped.startswith(("- ", "* ")):
            item_text = stripped[2:]
            parts = item_text.split("**")
            formatted_item = ""
            for idx, part in enumerate(parts):
                if idx % 2 == 1:
                    formatted_item += f'<strong>{html.escape(part)}</strong>'
                else:
                    formatted_item += html.escape(part)
            
            if not in_list:
                html_lines.append('<ul style="margin: 5px 0 10px 0; padding-left: 20px; list-style-type: disc;">')
                in_list = True
            html_lines.append(f'<li style="margin-bottom: 4px; color: #475569; font-size: 13.5px; line-height: 1.5;">{formatted_item}</li>')
        else:
            if in_list:
                html_lines.append('</ul>')
                in_list = False
                
            parts = line.split("**")
            formatted_line = ""
            for idx, part in enumerate(parts):
                if idx % 2 == 1:
                    formatted_line += f'<strong>{html.escape(part)}</strong>'
                else:
                    formatted_line += html.escape(part)
            html_lines.append(formatted_line)
        i += 1
        
    if in_table:
        html_lines.append(render_table(table_headers, table_rows))
    if in_list:
        html_lines.append('</ul>')
        
    output = ""
    for line in html_lines:
        if line.startswith(("<table", "<div", "<li", "<ul", "</ul>")):
            output += line + "\n"
        elif line.strip() == "":
            output += "<br/>\n"
        else:
            output += line + "<br/>\n"
            
    return output


async def send_candidate_task_email_via_smtp(
    candidate: Candidate,
    test_paper: CandidateTestPaper,
    db: AsyncSession
) -> None:
    # 1. Determine attachment and details
    temp_file_to_delete = None
    attachment_path = None
    attachment_name = None
    
    # Get Job and Position details to display in the email
    from app.v1.db.models.jobs import Job
    
    job_title = ""
    if candidate.applied_job_id:
        job = await db.get(Job, candidate.applied_job_id)
        if job:
            job_title = job.title
            if job.position:
                job_title = f"{job.title} ({job.position.name})"

    job_info_str = f" for the <strong>{job_title}</strong> position" if job_title else ""
    
    task_file_path = candidate.task_file_path or test_paper.task_file_path
    is_modified = True
    
    if test_paper:
        if test_paper.name == "Custom Test Paper" or test_paper.name.startswith("Randomized Test Paper"):
            is_modified = True
        elif test_paper.task_file_path:
            # Find the original QuestionSetPaper by task_file_path
            stmt_orig = select(QuestionSetPaper).where(QuestionSetPaper.task_file_path == test_paper.task_file_path)
            res_orig = await db.execute(stmt_orig)
            orig_paper = res_orig.scalar_one_or_none()
            if orig_paper:
                if orig_paper.questions == test_paper.questions and orig_paper.project_task == test_paper.project_task:
                    is_modified = False

    external_url = None
    if task_file_path and task_file_path.startswith(("http://", "https://")):
        external_url = task_file_path
    elif task_file_path and (not is_modified or not task_file_path.lower().endswith(".pdf")):
        abs_path = resolve_storage_path(task_file_path)
        if abs_path.is_file():
            attachment_path = str(abs_path)
            attachment_name = os.path.basename(task_file_path)
    else:
        # Generate PDF dynamically
        try:
            temp_file_to_delete = generate_candidate_task_pdf_file(candidate, test_paper, job_name=job_title)
            attachment_path = temp_file_to_delete
            attachment_name = f"Test_Paper_{candidate.first_name or 'Candidate'}.pdf"
        except Exception as e:
            logger.error(f"Failed to generate task PDF for email: {e}")

    # 2. Build HTML body
    details_html = ""
    if test_paper.questions or test_paper.project_task or external_url:
        details_html += '<div class="details-box">'
        if test_paper.questions:
            details_html += '<div class="details-title">Assigned Questions:</div>'
            details_html += '<ol class="questions-list">'
            for q in test_paper.questions:
                q_text = q.get("question", str(q)) if isinstance(q, dict) else str(q)
                q_html = markdown_to_html(q_text)
                details_html += f'<li style="margin-bottom: 15px;"><div style="font-family: inherit;">{q_html}</div></li>'
            details_html += '</ol>'
        if test_paper.project_task:
            if test_paper.questions:
                details_html += '<br>'
            details_html += '<div class="details-title">Project Tasks:</div>'
            details_html += '<ul class="questions-list">'
            for task in test_paper.project_task:
                if isinstance(task, dict):
                    task_name = task.get("task", task.get("title", task.get("content", "Untitled Task")))
                    instructions = task.get("instructions")
                    if instructions:
                        text = f"{task_name}\n\n**Instructions:**\n{instructions}"
                    else:
                        text = str(task_name)
                    task_html = markdown_to_html(text)
                else:
                    task_html = markdown_to_html(str(task))
                details_html += f'<li style="margin-bottom: 10px; font-size: 14px; line-height: 1.5; color: #4b5563;">{task_html}</li>'
            details_html += '</ul>'
        if external_url:
            if test_paper.questions or test_paper.project_task:
                details_html += '<br>'
            details_html += '<div class="details-title">External Task Link:</div>'
            details_html += f'<div style="font-size: 14px;"><a href="{external_url}" target="_blank" style="color: #3b82f6; text-decoration: underline;">{external_url}</a></div>'
        details_html += '</div>'

    html_body = f"""
    <html>
      <head>
        <style>
          body {{
            font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
            background-color: #f4f6f9;
            color: #333333;
            margin: 0;
            padding: 0;
          }}
          .container {{
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            overflow: hidden;
            border: 1px solid #eef2f6;
          }}
          .header {{
            background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
            padding: 30px;
            text-align: center;
            color: #ffffff;
          }}
          .header h1 {{
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.5px;
          }}
          .content {{
            padding: 40px 30px;
          }}
          .greeting {{
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 20px;
            color: #111827;
          }}
          .message {{
            font-size: 15px;
            line-height: 1.6;
            color: #4b5563;
            margin-bottom: 30px;
          }}
          .details-box {{
            background-color: #f9fafb;
            border-radius: 8px;
            padding: 20px;
            border-left: 4px solid #3b82f6;
            margin-bottom: 30px;
          }}
          .details-title {{
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 10px;
          }}
          .questions-list {{
            margin: 0;
            padding-left: 20px;
            color: #4b5563;
          }}
          .questions-list li {{
            margin-bottom: 10px;
            font-size: 14px;
            line-height: 1.5;
          }}
          .footer {{
            background-color: #f9fafb;
            padding: 20px 30px;
            text-align: center;
            font-size: 12px;
            color: #9ca3af;
            border-top: 1px solid #eef2f6;
          }}
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Hiring Assessment</h1>
          </div>
          <div class="content">
            <div class="greeting">Hello {candidate.first_name or "Candidate"},</div>
            <div class="message">
              We are pleased to invite you to take the next step in our interview process{job_info_str}. A test paper <strong></strong> has been assigned to you.
            </div>
            
            {details_html}

            <div class="message">
              Please review the questions and tasks above. If a PDF is attached, it contains the full details of your test paper.
            </div>
          </div>
          <div class="footer">
            August Infotech<br>
            32, SAI ASHISH SOCIETY PART-1, BEHIND VIJAY SALES, NR. CHANDNI CHOWK,<br>
            PIPLOD, SURAT 395007 | www.augustinfotech.com
          </div>
        </div>
      </body>
    </html>
    """

    # SMTP Configuration
    smtp_host = settings.SMTP_HOST
    smtp_port = settings.SMTP_PORT
    smtp_user = settings.SMTP_USER
    smtp_password = settings.SMTP_PASSWORD
    smtp_from = settings.SMTP_FROM_EMAIL

    # Always route emails to the override address for safety. Never send to actual candidates.
    target_recipient = settings.SMTP_TARGET_EMAIL_OVERRIDE
    if not target_recipient:
        raise ValueError("SMTP_TARGET_EMAIL_OVERRIDE is not configured in .env. Cannot send emails.")

    # Build MIME message
    msg = MIMEMultipart()
    msg["From"] = smtp_from
    msg["To"] = target_recipient
    # Fetch job details for the subject
    from app.v1.db.models.jobs import Job
    job = await db.get(Job, candidate.applied_job_id) if candidate.applied_job_id else None
    job_name = job.title if job else "Job"
    job_position = job.position.name if job and job.position else "Position"

    msg["Subject"] = f"[{job_position}-{job_name} Test Paper assigned for {candidate.first_name or 'Candidate'} {candidate.last_name or ''}]"
    
    msg.attach(MIMEText(html_body, "html"))

    if attachment_path and attachment_name:
        try:
            with open(attachment_path, "rb") as f:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(f.read())
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                f"attachment; filename={attachment_name}",
            )
            msg.attach(part)
        except Exception as e:
            logger.error(f"Failed to attach file to email: {e}")

    # Send email synchronously in threadpool to avoid blocking event loop
    def send_sync():
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            if server.has_extn('STARTTLS'):
                server.starttls()
                server.ehlo()
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.sendmail(smtp_from, [target_recipient], msg.as_string())

    try:
        await asyncio.to_thread(send_sync)
    finally:
        if temp_file_to_delete and os.path.exists(temp_file_to_delete):
            try:
                os.unlink(temp_file_to_delete)
            except Exception:
                pass


async def send_associate_notification_email(
    associate_name: str,
    associate_email: str,
    candidate: Candidate,
    test_paper: CandidateTestPaper,
    github_url: Optional[str] = None,
    review_token: uuid.UUID = None,
    db: AsyncSession = None,
    stage_job_id: Optional[uuid.UUID] = None,
) -> None:
    """Send test paper + candidate GitHub URL to an associate for the GitHub+Question round.

    Reuses the same PDF generation and SMTP safety pattern as
    ``send_candidate_task_email_via_smtp`` but targets an associate (reviewer)
    instead of the candidate.
    """
    temp_file_to_delete = None
    attachment_path = None
    attachment_name = None

    # 1. Resolve job/position/department details for the email subject and body
    from app.v1.db.models.jobs import Job

    job_title = ""
    job_position = "Position"
    job_department = "Department"
    
    job = None
    if stage_job_id:
        job = await db.get(Job, stage_job_id)
    if job is None and candidate.applied_job_id:
        job = await db.get(Job, candidate.applied_job_id)
        
    if job:
        job_title = job.title or ""
        # department and position are lazy="joined" relationships
        if job.department:
            job_department = job.department.name or "Department"
        if job.position:
            job_position = job.position.name or "Position"

    job_info_str = f" for the <strong>{job_title}</strong> position" if job_title else ""
    candidate_full_name = f"{candidate.first_name or 'Candidate'} {candidate.last_name or ''}".strip()
    work_drive_link = "https://www.augustinfotech.com/"

    # Build the review form link using the unique review token (no auth required).
    # The associate clicks this link to open a backend-served HTML form where they
    # enter marks per question and submit.
    review_form_url = f"{settings.APP_BASE_URL.rstrip('/')}/api/v1/associate-reviews/{review_token}"

    # 2. Determine attachment (reuse same logic as candidate email)
    task_file_path = test_paper.task_file_path if test_paper else None
    external_url = None
    if task_file_path and task_file_path.startswith(("http://", "https://")):
        external_url = task_file_path
    elif task_file_path and task_file_path.lower().endswith(".pdf"):
        abs_path = resolve_storage_path(task_file_path)
        if abs_path.is_file():
            attachment_path = str(abs_path)
            attachment_name = os.path.basename(task_file_path)
    else:
        # Generate PDF dynamically
        try:
            temp_file_to_delete = generate_candidate_task_pdf_file(
                candidate, test_paper, job_name=job_title
            )
            attachment_path = temp_file_to_delete
            attachment_name = f"Test_Paper_{candidate.first_name or 'Candidate'}.pdf"
        except Exception as e:
            logger.error(f"Failed to generate task PDF for associate email: {e}")

    # 3. Build HTML body (questions/tasks are in the attached PDF, not in the email body)
    html_body = f"""
    <html>
      <head>
        <style>
          body {{
            font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
            background-color: #f4f6f9;
            color: #333333;
            margin: 0;
            padding: 0;
          }}
          .container {{
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            overflow: hidden;
            border: 1px solid #eef2f6;
          }}
          .header {{
            background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
            padding: 30px;
            text-align: center;
            color: #ffffff;
          }}
          .header h1 {{
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.5px;
          }}
          .content {{
            padding: 40px 30px;
          }}
          .greeting {{
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 20px;
            color: #111827;
          }}
          .message {{
            font-size: 15px;
            line-height: 1.6;
            color: #4b5563;
            margin-bottom: 30px;
          }}
          .github-box {{
            background-color: #eff6ff;
            border-radius: 8px;
            padding: 20px;
            border-left: 4px solid #2563eb;
            margin-bottom: 30px;
          }}
          .github-title {{
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 10px;
          }}
          .github-link {{
            font-size: 15px;
            word-break: break-all;
          }}
          .candidate-info-box {{
            background-color: #f9fafb;
            border-radius: 8px;
            padding: 20px;
            border-left: 4px solid #3b82f6;
            margin-bottom: 30px;
          }}
          .info-row {{
            display: flex;
            margin-bottom: 10px;
            font-size: 14px;
            line-height: 1.5;
          }}
          .info-label {{
            font-weight: 600;
            color: #1f2937;
            min-width: 140px;
          }}
          .info-value {{
            color: #4b5563;
            flex: 1;
          }}
          .work-drive-box {{
            background-color: #ecfdf5;
            border-radius: 8px;
            padding: 20px;
            border-left: 4px solid #10b981;
            margin-bottom: 30px;
          }}
          .work-drive-title {{
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 10px;
          }}
          .work-drive-link {{
            font-size: 15px;
          }}
          .review-form-box {{
            background-color: #fef3c7;
            border-radius: 8px;
            padding: 24px 20px;
            border-left: 4px solid #f59e0b;
            margin-bottom: 30px;
            text-align: center;
          }}
          .review-form-title {{
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 12px;
            font-size: 16px;
          }}
          .review-form-text {{
            font-size: 14px;
            color: #4b5563;
            margin-bottom: 16px;
            line-height: 1.5;
          }}
          .review-form-button {{
            display: inline-block;
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 32px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 15px;
          }}
          .footer {{
            background-color: #f9fafb;
            padding: 20px 30px;
            text-align: center;
            font-size: 12px;
            color: #9ca3af;
            border-top: 1px solid #eef2f6;
          }}
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Candidate Evaluation Assignment</h1>
          </div>
          <div class="content">
            <div class="greeting">Hello {html.escape(associate_name)},</div>
            <div class="message">
              You have been assigned to evaluate the GitHub repository and test paper for
              <strong>{html.escape(candidate_full_name)}</strong>{job_info_str}.
            </div>

            <div class="candidate-info-box">
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
                <div class="info-value">{html.escape(job_department)}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Position:</div>
                <div class="info-value">{html.escape(job_position)}</div>
              </div>
            </div>

            {f'''
            <div class="github-box">
              <div class="github-title">Candidate GitHub Repository:</div>
              <div class="github-link">
                <a href="{html.escape(github_url)}" target="_blank" style="color: #2563eb; text-decoration: underline;">{html.escape(github_url)}</a>
              </div>
            </div>
            ''' if github_url else ""}

            <div class="work-drive-box">
              <div class="work-drive-title">Work Drive Link:</div>
              <div class="work-drive-link">
                <a href="{html.escape(work_drive_link)}" target="_blank" style="color: #10b981; text-decoration: underline;">{html.escape(work_drive_link)}</a>
              </div>
            </div>

            <div class="review-form-box">
              <div class="review-form-title">📝 Submit Your Evaluation</div>
              <div class="review-form-text">
                After reviewing the candidate's GitHub repository and test paper,
                please click the button below to open the review form and submit your marks
                for each question.
              </div>
              <a href="{html.escape(review_form_url)}" class="review-form-button" target="_blank">
                Open Review Form
              </a>
            </div>

            <div class="message">
              {f"Please review the candidate's GitHub repository using the link above." if github_url else ""}
              The attached PDF contains the full details of the test paper (questions and project tasks).
            </div>
          </div>
          <div class="footer">
            August Infotech<br>
            32, SAI ASHISH SOCIETY PART-1, BEHIND VIJAY SALES, NR. CHANDNI CHOWK,<br>
            PIPLOD, SURAT 395007 | www.augustinfotech.com
          </div>
        </div>
      </body>
    </html>
    """

    # 5. SMTP Configuration (same safety pattern as candidate email)
    smtp_host = settings.SMTP_HOST
    smtp_port = settings.SMTP_PORT
    smtp_user = settings.SMTP_USER
    smtp_password = settings.SMTP_PASSWORD
    smtp_from = settings.SMTP_FROM_EMAIL

    # Use the actual associate's email directly, bypassing the candidate override
    target_recipient = associate_email
    if not target_recipient:
        raise ValueError("Associate email is missing. Cannot send email.")

    # 6. Build MIME message
    msg = MIMEMultipart()
    msg["From"] = smtp_from
    msg["To"] = target_recipient
    msg["Subject"] = f"[{job_position}-{job_title or 'Job'}] GitHub Repo + Test Paper for {candidate_full_name}]"

    msg.attach(MIMEText(html_body, "html"))

    if attachment_path and attachment_name:
        try:
            with open(attachment_path, "rb") as f:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(f.read())
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                f"attachment; filename={attachment_name}",
            )
            msg.attach(part)
        except Exception as e:
            logger.error(f"Failed to attach file to associate email: {e}")

    # 7. Send email synchronously in threadpool
    def send_sync():
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            if server.has_extn('STARTTLS'):
                server.starttls()
                server.ehlo()
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.sendmail(smtp_from, [target_recipient], msg.as_string())

    try:
        await asyncio.to_thread(send_sync)
    finally:
        if temp_file_to_delete and os.path.exists(temp_file_to_delete):
            try:
                os.unlink(temp_file_to_delete)
            except Exception:
                pass
