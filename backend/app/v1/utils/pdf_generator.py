import os
import io
import uuid
from pathlib import Path
from pypdf import PdfReader, PdfWriter
import fitz
import tempfile
from app.v1.db.models.candidates import Candidate
from app.v1.db.models.candidate_test_paper import CandidateTestPaper
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

from app.v1.core.config import settings
from app.v1.core.storage import resolve_storage_path, to_storage_relative_path

def sanitize_for_pdf(text: str) -> str:
    if not isinstance(text, str):
        return text
    replacements = {
        '\u2018': "'", '\u2019': "'",
        '\u201c': '"', '\u201d': '"',
        '\u2013': '-', '\u2014': '--',
        '\u2026': '...', '\u2022': '*',
        '\xa0': ' ', '\u00ad': '-',
    }
    for search, replace in replacements.items():
        text = text.replace(search, replace)
    
    # Strip non-latin1 to avoid reportlab black squares
    return text.encode('latin-1', 'ignore').decode('latin-1')

def generate_questions_pdf(paper_name: str, questions: list[str]) -> io.BytesIO:
    """
    Generate a PDF containing the generated test questions using reportlab.
    Returns a BytesIO object of the generated PDF.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72
    )
    
    styles = getSampleStyleSheet()
    title_style = styles['Heading1']
    question_style = styles['Normal']
    question_style.spaceAfter = 14
    question_style.fontSize = 11
    question_style.leading = 14
    
    Story = []
    
    Story.append(Paragraph(f"Technical Assessment: {paper_name}", title_style))
    Story.append(Spacer(1, 20))
    
    Story.append(Paragraph("Part 1: Technical Questions", styles['Heading2']))
    Story.append(Paragraph("Please provide brief written answers to the following questions:", styles['Normal']))
    Story.append(Spacer(1, 15))
    
    for i, q in enumerate(questions, 1):
        Story.append(Paragraph(f"<b>{i}.</b> {sanitize_for_pdf(q)}", question_style))
        
    doc.build(Story)
    buffer.seek(0)
    return buffer

def create_and_store_master_pdf(paper_id: uuid.UUID, paper_name: str, questions: list[str], template_file_path: str = None) -> str:
    """
    Generates the questions PDF, merges it with the template PDF (if provided and is a PDF), 
    and saves it to the storage directory.
    Returns the relative storage path of the new master PDF.
    """
    tasks_dir = resolve_storage_path(settings.TASK_UPLOAD_DIR)
    tasks_dir.mkdir(parents=True, exist_ok=True)
    
    master_file_name = f"generated_paper_{paper_id}.pdf"
    master_target_path = tasks_dir / master_file_name
    
    # 1. Generate the questions PDF
    questions_pdf_buffer = generate_questions_pdf(paper_name, questions)
    
    pdf_writer = PdfWriter()
    
    # 2. Add generated questions as the first page(s)
    questions_reader = PdfReader(questions_pdf_buffer)
    for page in questions_reader.pages:
        pdf_writer.add_page(page)
        
    # 3. Append the original template if it's a PDF
    if template_file_path and template_file_path.lower().endswith('.pdf'):
        abs_template_path = resolve_storage_path(template_file_path)
        if abs_template_path.is_file():
            template_reader = PdfReader(str(abs_template_path))
            for page in template_reader.pages:
                pdf_writer.add_page(page)
                
    # 4. Write out the combined PDF
    with open(master_target_path, "wb") as f:
        pdf_writer.write(f)
        
    return to_storage_relative_path(master_target_path)


def generate_candidate_task_pdf_file(
    candidate: Candidate,
    test_paper: CandidateTestPaper,
    job_name: str = "",
    guideline_content: str = None
) -> str:
    import re
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_RIGHT
    from reportlab.lib import colors

    temp_pdf_rl = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    temp_pdf_rl.close()

    # Generate document layout with ReportLab
    doc_rl = SimpleDocTemplate(
        temp_pdf_rl.name, 
        pagesize=letter, 
        rightMargin=50, 
        leftMargin=50, 
        topMargin=100,  # leave space for logo
        bottomMargin=80 # leave space for footer
    )
    
    styles = getSampleStyleSheet()
    title_style = styles['Heading1']
    normal_style = styles['Normal']
    normal_style.fontSize = 11
    normal_style.spaceAfter = 10
    
    tag_style = ParagraphStyle(
        name='TagStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.gray,
        alignment=TA_RIGHT
    )

    Story = []
    display_title = sanitize_for_pdf(job_name if job_name else test_paper.name)
    Story.append(Paragraph(f"Test Paper: {display_title}", title_style))
    Story.append(Spacer(1, 20))
    
    def format_meta(item: dict) -> str:
        parts = []
        if item.get("marks"): parts.append(f"{item['marks']} Marks")
        if item.get("duration"): parts.append(f"{item['duration']} Mins")
        return f" ({' | '.join(parts)})" if parts else ""
    
    def add_question(q_text, prefix):
        match = re.match(r'^\[(.*?)\] (.*)', q_text)
        if match:
            tag = sanitize_for_pdf(f"[{match.group(1)}]")
            text = sanitize_for_pdf(match.group(2))
        else:
            tag = ""
            text = sanitize_for_pdf(q_text)
            
        p_text = Paragraph(f"<b>{prefix}</b> {text}", normal_style)
        if tag:
            p_tag = Paragraph(tag, tag_style)
            t = Table([[p_text, p_tag]], colWidths=[400, 100])
            t.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 10),
            ]))
            Story.append(t)
        else:
            Story.append(p_text)

    if test_paper.project_task:
        tasks = test_paper.project_task if isinstance(test_paper.project_task, list) else [test_paper.project_task]
        has_top_content = False
        for t in tasks:
            if isinstance(t, dict):
                if t.get("instructions"):
                    has_top_content = True
                    break
                    
        if has_top_content:
            Story.append(Paragraph("<b>Project Instructions:</b>", styles['Heading2']))
            for t in tasks:
                if isinstance(t, dict):
                    instructions = t.get("instructions")
                    if instructions:
                        Story.append(Paragraph(f"<b>Instructions:</b> {sanitize_for_pdf(instructions)}", normal_style))
            Story.append(Spacer(1, 10))

    if test_paper.questions:
        Story.append(Paragraph("<b>Questions:</b>", styles['Heading2']))
        questions = test_paper.questions if isinstance(test_paper.questions, list) else [test_paper.questions]
        for i, q in enumerate(questions):
            if isinstance(q, dict):
                q_text = q.get("question", "")
                q_text += format_meta(q)
                add_question(q_text, f"{i+1}.")
            else:
                add_question(q, f"{i+1}.")
            
    if getattr(test_paper, "mcqs", None):
        Story.append(Paragraph("<b>Multiple Choice Questions:</b>", styles['Heading2']))
        for i, mcq in enumerate(test_paper.mcqs):
            if isinstance(mcq, dict):
                q_text = mcq.get("question", "")
                q_text += format_meta(mcq)
            else:
                q_text = getattr(mcq, "question", "")
                if hasattr(mcq, "model_dump"):
                    q_text += format_meta(mcq.model_dump())
            add_question(q_text, f"{i+1}.")
            options = mcq.get("options") if isinstance(mcq, dict) else getattr(mcq, "options", [])
            for opt in options:
                Story.append(Paragraph(f"   - {sanitize_for_pdf(opt)}", normal_style))
            Story.append(Spacer(1, 10))

    if test_paper.project_task:
        Story.append(Paragraph("<b>Project Tasks:</b>", styles['Heading2']))
        tasks = test_paper.project_task if isinstance(test_paper.project_task, list) else [test_paper.project_task]
        
        for t in tasks:
            if isinstance(t, dict):
                # New nested format handling
                title = t.get("title") or t.get("task") or t.get("content", "Untitled Project")
                title = str(title) + format_meta(t)
                Story.append(Paragraph(f"<b>{sanitize_for_pdf(title)}</b>", styles['Heading3']))
                
                desc = t.get("description")
                if desc:
                    Story.append(Paragraph(f"<b>Description:</b> {sanitize_for_pdf(desc)}", normal_style))
                    
                subtasks = t.get("tasks")
                if subtasks and isinstance(subtasks, list):
                    Story.append(Spacer(1, 5))
                    for sub in subtasks:
                        if isinstance(sub, dict):
                            sub_name = sub.get("name", "Untitled Task")
                            sub_name = str(sub_name) + format_meta(sub)
                            add_question(sub_name, "-")
                            sub_desc = sub.get("description")
                            if sub_desc:
                                Story.append(Paragraph(f"   {sanitize_for_pdf(sub_desc)}", normal_style))
                        else:
                            add_question(str(sub), "-")
                Story.append(Spacer(1, 10))
            else:
                add_question(str(t), "-")

    if guideline_content:
        Story.append(Spacer(1, 20))
        Story.append(Paragraph("<b>Terms & Conditions:</b>", styles['Heading2']))
        
        # Simple markdown to ReportLab HTML-like tags
        gc_safe = sanitize_for_pdf(guideline_content)
        # Convert **bold** to <b>bold</b>
        gc_safe = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', gc_safe)
        
        lines = gc_safe.split('\n')
        in_list = False
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
            
            if stripped.startswith(('- ', '* ', '· ')):
                bullet_text = stripped[2:]
                Story.append(Paragraph(f"• {bullet_text}", normal_style))
            elif stripped.startswith(('#')):
                # headings
                header_text = stripped.lstrip('#').strip()
                Story.append(Spacer(1, 10))
                Story.append(Paragraph(f"<b>{header_text}</b>", styles['Heading3']))
            else:
                Story.append(Paragraph(stripped, normal_style))
                
        Story.append(Spacer(1, 10))

    doc_rl.build(Story)

    # Post-process with PyMuPDF to add logo and footer
    doc = fitz.open(temp_pdf_rl.name)
    
    logo_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "frontend", "src", "assets", "logo.svg")
    has_logo = False
    pdf_doc_logo = None
    if os.path.exists(logo_path):
        try:
            svg_doc = fitz.open(logo_path)
            pdf_bytes = svg_doc.convert_to_pdf()
            pdf_doc_logo = fitz.open("pdf", pdf_bytes)
            has_logo = True
        except Exception as e:
            print(f"Failed to load logo: {e}")

    footer_text = "32, SAI ASHISH SOCIETY PART-1, BEHIND VIJAY SALES, NR. CHANDNI CHOWK,\nPIPLOD, SURAT 395007 | www.augustinfotech.com"

    for page in doc:
        if has_logo and pdf_doc_logo:
            page.show_pdf_page(fitz.Rect(50, 40, 200, 80), pdf_doc_logo, 0)
            
        page.insert_textbox(
            fitz.Rect(50, 750, 550, 800), 
            footer_text, 
            fontsize=10, 
            fontname="hebo", 
            align=fitz.TEXT_ALIGN_CENTER
        )

    temp_pdf_final = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    temp_pdf_final.close()
    doc.save(temp_pdf_final.name)
    doc.close()
    
    # Cleanup intermediate file
    try:
        os.unlink(temp_pdf_rl.name)
    except:
        pass
        
    return temp_pdf_final.name
