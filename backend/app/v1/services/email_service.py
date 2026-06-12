import os
import html
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
                q_html = markdown_to_html(q)
                details_html += f'<li style="margin-bottom: 15px;"><div style="font-family: inherit;">{q_html}</div></li>'
            details_html += '</ol>'
        if test_paper.project_task:
            if test_paper.questions:
                details_html += '<br>'
            details_html += '<div class="details-title">Project Task:</div>'
            task_html = markdown_to_html(test_paper.project_task)
            details_html += f'<div style="font-size: 14px; line-height: 1.5; color: #4b5563;">{task_html}</div>'
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
              We are pleased to invite you to take the next step in our interview process{job_info_str}. A test paper <strong>"{test_paper.name}"</strong> has been assigned to you.
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
    target_recipient = "shreyshukla512@gmail.com"

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
