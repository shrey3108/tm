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
        Story.append(Paragraph(f"<b>{i}.</b> {q}", question_style))
        
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
    test_paper: CandidateTestPaper
) -> str:
    doc = fitz.open()
    
    # Prepare text content
    text_content = f"Test Paper: {test_paper.name}\n"
    text_content += "-" * 50 + "\n\n"
    
    if test_paper.questions:
        text_content += "Questions:\n"
        for i, q in enumerate(test_paper.questions):
            text_content += f"{i+1}. {q}\n\n"
    
    if test_paper.project_task:
        text_content += f"Project Task:\n{test_paper.project_task}\n\n"

    rect = fitz.Rect(50, 110, 550, 750)
    lines = text_content.split("\n")
    remaining_lines = lines
    
    while remaining_lines:
        page = doc.new_page()
        
        # Insert Logo at Top Left
        logo_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "frontend", "src", "assets", "logo.svg")
        if os.path.exists(logo_path):
            try:
                svg_doc = fitz.open(logo_path)
                pdf_bytes = svg_doc.convert_to_pdf()
                pdf_doc = fitz.open("pdf", pdf_bytes)
                page.show_pdf_page(fitz.Rect(50, 40, 200, 80), pdf_doc, 0)
            except Exception as e:
                print(f"Failed to load logo: {e}")
        
        # Add Footer
        footer_text = "32, SAI ASHISH SOCIETY PART-1, BEHIND VIJAY SALES, NR. CHANDNI CHOWK,\nPIPLOD, SURAT 395007 | www.augustinfotech.com"
        page.insert_textbox(
            fitz.Rect(50, 780, 550, 830), 
            footer_text, 
            fontsize=10, 
            fontname="hebo", 
            align=fitz.TEXT_ALIGN_CENTER
        )
        
        fitted_lines_count = 0
        temp_text = ""
        
        for line in remaining_lines:
            test_text = temp_text + line + "\n"
            
            test_doc = fitz.open()
            test_page = test_doc.new_page()
            rc = test_page.insert_textbox(rect, test_text, fontsize=11, fontname="helv")
            test_doc.close()
            
            if rc >= 0:
                temp_text = test_text
                fitted_lines_count += 1
            else:
                break
                
        if fitted_lines_count == 0:
            page.insert_textbox(rect, remaining_lines[0], fontsize=11, fontname="helv")
            remaining_lines = remaining_lines[1:]
        else:
            page.insert_textbox(rect, temp_text.rstrip("\n"), fontsize=11, fontname="helv")
            remaining_lines = remaining_lines[fitted_lines_count:]

    # Save to temp file
    temp_pdf = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    temp_pdf.close() # Close the file handle so PyMuPDF can write to it on Windows
    doc.save(temp_pdf.name)
    doc.close()
    return temp_pdf.name
