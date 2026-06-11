import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import asyncio
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.v1.db.models.candidates import Candidate
from app.v1.db.models.candidate_test_paper import CandidateTestPaper
from app.v1.db.models.question_set_paper import QuestionSetPaper
from app.v1.core.config import settings
from app.v1.core.storage import resolve_storage_path
from app.v1.utils.pdf_generator import generate_candidate_task_pdf_file

logger = logging.getLogger(__name__)

async def send_candidate_task_email_via_smtp(
    candidate: Candidate,
    test_paper: CandidateTestPaper,
    db: AsyncSession
) -> None:
    # 1. Determine attachment and details
    temp_file_to_delete = None
    attachment_path = None
    attachment_name = None
    
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
            temp_file_to_delete = generate_candidate_task_pdf_file(candidate, test_paper)
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
                details_html += f'<li>{q}</li>'
            details_html += '</ol>'
        if test_paper.project_task:
            if test_paper.questions:
                details_html += '<br>'
            details_html += '<div class="details-title">Project Task:</div>'
            details_html += f'<div style="font-size: 14px; line-height: 1.5; color: #4b5563; white-space: pre-wrap;">{test_paper.project_task}</div>'
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
              We are pleased to invite you to take the next step in our interview process. A test paper <strong>"{test_paper.name}"</strong> has been assigned to you.
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

    # Override target recipient to the user-requested hardcoded safety test email
    target_recipient = "moxiyi8243@herojp.com"

    # Build MIME message
    msg = MIMEMultipart()
    msg["From"] = smtp_from
    msg["To"] = target_recipient
    msg["Subject"] = f"[TEST] Test Paper Assigned for {candidate.first_name or 'Candidate'} {candidate.last_name or ''} (intended for: {candidate.email})"
    
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
            server.starttls()
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
