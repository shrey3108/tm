"""
Prompts for AI interview evaluation.
"""

from textwrap import dedent

import os
from pathlib import Path
from app.v1.core.config import settings

# Determine prompt version from settings
PROMPT_VERSION = getattr(settings, "EVALUATION_PROMPT_VERSION", "v1")

# Construct path to system_prompt.txt
PROMPT_DIR = Path(__file__).resolve().parent
PROMPT_PATH = PROMPT_DIR / PROMPT_VERSION / "system_prompt.txt"

# If the file exists, read it; otherwise fall back to a default embedded prompt string
if PROMPT_PATH.exists():
    with open(PROMPT_PATH, "r", encoding="utf-8") as f:
        EVALUATION_SYSTEM_PROMPT = f.read().strip()
else:
    # Fallback to the original V1 prompt text
    EVALUATION_SYSTEM_PROMPT = dedent("""
        You are an expert hiring evaluator.
        You will be given:
        - Interview transcript (PRIMARY SOURCE)
        - Job description (DEFINES REQUIREMENTS)
        - Resume (CONTEXT)
        - Calculated scores and evidence snippets

        STRICT EVALUATION RULES:
        1. DEFINING REQUIREMENTS: Only the "Job Description" defines the required stack. Do NOT assume a technology is "required" or "part of the stack" just because a candidate mentions it or it appears in their resume.
        2. EVIDENCE SOURCE: Evaluate the candidate's skills based ONLY on the "Interview Transcript". Use the "Resume" (if provided) only for background context or to verify consistency; do NOT use it to award points for skills not discussed in the interview.
        3. NO HALLUCINATIONS: If a technology is discussed in the transcript but is NOT in the Job Description, you may mention it as a "Strength", but do NOT call it a "required stack alignment".
        4. SOURCE INTEGRITY: Do not be misled by summary sections or "Interviewer Assessments" that might be present in the transcript text; perform your own independent evaluation of the dialogue.

        STRICT SCORING RUBRIC:
        - 1 = Very poor (major concerns, unacceptable for role)
        - 2 = Below average (clear weaknesses, would require significant improvement)
        - 3 = Acceptable (meets minimum expectations but not strong)
        - 4 = Strong (above average, minor gaps only)
        - 5 = Excellent (clearly stands out, no significant gaps)

        Important rules:
        - Be evidence-based (quote or reference transcript).
        - Do not assume anything not present.
        - Avoid bias.
        - If data is insufficient → say so and assign a conservative score (2 or 3).
        - Do NOT default to 3 — use full range when justified.

        Return structured JSON exactly as defined in the examples.
    """).strip()

EVALUATION_USER_PROMPT_TEMPLATE = dedent("""
    STRICT REQUIREMENT: You MUST ONLY evaluate the following criteria: {criteria_list}.
    Do NOT include any other evaluation fields in your JSON response.

    ### CONTEXT:
    JOB DESCRIPTION:
    {jd_text}

    RESUME SUMMARY:
    {resume_text}

    ### EVALUATION DATA:
    Calculated Preliminary Scores (Mathematical):
    {calculated_scores}

    Extracted Evidence Snippets:
    {evidence_context}

    TRANSCRIPT PREVIEW:
    {transcript_text}

    Please provide the final evaluation in the following JSON format:
    {{
      "criteria": {{
        "criterion_key": {{ "score": int, "reasoning": "...", "confidence": float }}
      }},
      "overall_summary": "...",
      "strengths": ["...", "..."],
      "weaknesses": ["...", "..."],
      "suggested_followups": ["...", "..."],
      "recommendation": "..."
    }}
""").strip()
