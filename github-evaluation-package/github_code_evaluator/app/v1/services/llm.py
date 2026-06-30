import asyncio
import json
import logging
import os
from pathlib import Path
import re
from typing import Any, Dict, List, Optional
import yaml

import litellm
from pydantic import BaseModel, Field

from github_code_evaluator.app.v1.core.config import settings

logger = logging.getLogger(__name__)

# Try to register Arize Phoenix OpenTelemetry tracing
if os.getenv("ENABLE_PHOENIX", "false").lower() == "true":
    try:
        from phoenix.otel import register
        collector_endpoint = os.getenv(
            "PHOENIX_COLLECTOR_ENDPOINT", "http://localhost:6006/v1/traces"
        )
        register(
            project_name="github-evaluator",
            endpoint=collector_endpoint,
            auto_instrument=True,
        )
        logger.info("Arize Phoenix OpenTelemetry tracing initialized successfully.")
    except Exception as e:
        logger.warning(f"Could not initialize Arize Phoenix tracing: {e}")
else:
    logger.info("Arize Phoenix tracing is disabled per ENABLE_PHOENIX configuration.")

# Optional configuration file path for LiteLLM Router
LITELLM_CONFIG_PATH = Path(__file__).resolve().parents[3] / "config" / "litellm.yaml"


class LLMValidationException(Exception):
    """Custom exception raised when LLM validation or parsing fails, storing raw response."""
    def __init__(self, message: str, raw_response: str):
        super().__init__(message)
        self.raw_response = raw_response


class CategoryScoresSchema(BaseModel):
    correctness: float = Field(..., ge=0.0, le=5.0)
    code_quality: float = Field(..., ge=0.0, le=5.0)
    architecture: float = Field(..., ge=0.0, le=5.0)
    security: float = Field(..., ge=0.0, le=5.0)
    performance: float = Field(..., ge=0.0, le=5.0)
    documentation: float = Field(..., ge=0.0, le=5.0)


class AlignmentReportSchema(BaseModel):
    strengths: List[str]
    weaknesses: List[str]
    alignment_review: str
    interview_questions: List[str]
    scores: CategoryScoresSchema
    correctness_review: str
    code_quality_review: str
    architecture_review: str
    security_review: str
    performance_review: str
    documentation_review: str


class EvaluationReportSchema(BaseModel):
    seniority_estimate: str  # Intern | Freshers | Intermediate | Senior
    recommendation: str  # Proceed | Reject
    scores: CategoryScoresSchema
    security_risks: List[str]
    architecture_review: str
    code_quality_review: str
    architecture_score: float = Field(default=0.0, ge=0.0, le=5.0)
    code_quality_score: float = Field(default=0.0, ge=0.0, le=5.0)
    security_score: float = Field(default=0.0, ge=0.0, le=5.0)
    extraordinary_score: float = Field(default=0.0, ge=0.0, le=5.0)
    jd_alignment_report: Optional[str] = None
    project_alignment_report: Optional[str] = None
    jd_alignment: AlignmentReportSchema
    project_alignment: AlignmentReportSchema
    extraordinary_points: List[str] = Field(default_factory=list)


class LLMEvaluationService:
    """Service to handle LLM completions using LiteLLM gateway."""

    def __init__(self):
        self.router = None
        self._init_router()

    def _init_router(self) -> None:
        """Initialize the LiteLLM Router if config file exists, otherwise use completion directly."""
        try:
            if os.path.exists(LITELLM_CONFIG_PATH):
                from litellm import Router
                logger.info(f"Loading LiteLLM config from {LITELLM_CONFIG_PATH}")
                
                # Ensure litellm can find the env vars from settings
                if settings.LITELLM_BASE_URL:
                    os.environ["LITELLM_BASE_URL"] = settings.LITELLM_BASE_URL
                if settings.OPENAI_API_KEY:
                    os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY.get_secret_value()
                if settings.LITELLM_API_KEY:
                    os.environ["LITELLM_API_KEY"] = settings.LITELLM_API_KEY.get_secret_value()

                with open(LITELLM_CONFIG_PATH, "r") as f:
                    config = yaml.safe_load(f)
                model_list = config.get("model_list", [])
                self.router = Router(model_list=model_list)
            else:
                logger.info("LiteLLM router config not found; using direct litellm completions.")
        except Exception as e:
            logger.error(f"Failed to initialize LiteLLM router: {e}")

    async def call_llm(self, messages: List[Dict[str, str]], model: Optional[str] = None) -> str:
        """Submit chat completions request through the LiteLLM router/client asynchronously."""
        try:
            if not model:
                model = settings.LLM_MODEL
            # Configure API base and key if provided
            kwargs = {}
            if settings.LITELLM_BASE_URL:
                kwargs["api_base"] = settings.LITELLM_BASE_URL
            if settings.OPENAI_API_KEY:
                kwargs["api_key"] = settings.OPENAI_API_KEY.get_secret_value()

            # Map simple name to provider if needed for litellm
            # Ollama needs the ollama/ prefix if not using router
            if not self.router and "ollama" in (settings.LITELLM_BASE_URL or "").lower() and not model.startswith("ollama/"):
                model = f"ollama/{model}"

            logger.info(f"Submitting async request to model {model}...")
            if self.router:
                response = await self.router.acompletion(
                    model=model,
                    messages=messages,
                    temperature=0.1,
                    timeout=settings.EVALUATION_LLM_TIMEOUT,
                )
            else:
                response = await litellm.acompletion(
                    model=model,
                    messages=messages,
                    temperature=0.1,
                    timeout=settings.EVALUATION_LLM_TIMEOUT,
                    **kwargs,
                )
            
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"LiteLLM completion call failed: {e}")
            raise e

    def parse_json_safely(self, response_text: str) -> Dict[str, Any]:
        """Extracts and parses JSON evaluation report content from raw LLM responses."""
        cleaned = response_text.strip()

        # Extract markdown JSON block if present
        match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", cleaned, re.DOTALL)
        if match:
            cleaned = match.group(1)
        else:
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start != -1 and end != -1:
                cleaned = cleaned[start : end + 1]

        try:
            data = json.loads(cleaned)
            # Ensure Pydantic validation passes
            validated = EvaluationReportSchema.model_validate(data)
            return validated.model_dump()
        except Exception as e:
            logger.error(f"JSON validation failed: {e}. Raw response: {response_text}")
            raise LLMValidationException(
                message=f"JSON output validation failed: {str(e)}",
                raw_response=response_text
            )

    def build_prompt(
        self,
        repo_name: str,
        tech_stack: Dict[str, List[str]],
        repo_context: str,
        job_title: str,
        job_position: str,
        jd_skills: Optional[List[str]] = None,
        project_required_skills: Optional[List[str]] = None,
        prompt_template: Optional[str] = None,
        secrets_findings: Optional[List[Dict[str, Any]]] = None,
        bandit_findings: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        """Construct prompt message for the evaluator model."""
        jd_skills_str = ", ".join(jd_skills) if jd_skills else "None specified"
        project_skills_str = ", ".join(project_required_skills) if project_required_skills else "None specified"
        job_position_str = job_position if job_position else "Not Specified"

        # Format and append static scan findings to the repository context if any exist
        findings_str = ""
        if secrets_findings or bandit_findings:
            findings_str += "\n\nSTATIC SECURITY SCAN FINDINGS:\n"
            findings_str += "Our automated static security scanners flagged the following potential issues in the candidate's repository:\n"
            if secrets_findings:
                findings_str += "1. Potential Hardcoded Secrets/Credentials:\n"
                for idx, f in enumerate(secrets_findings, start=1):
                    findings_str += f"   - Finding #{idx}: File '{f.get('file')}', Line {f.get('line')}: {f.get('finding')}\n"
            if bandit_findings:
                findings_str += "2. Potential Static Code Vulnerabilities (Bandit):\n"
                for idx, f in enumerate(bandit_findings, start=1):
                    findings_str += f"   - Finding #{idx}: File '{f.get('filename')}', Line {f.get('line_number')}: {f.get('issue_text')} (Severity: {f.get('issue_severity')})\n"
            findings_str += "\nCRITICAL INSTRUCTION FOR SECURITY EVALUATION:\n"
            findings_str += "Please analyze the flagged code files and findings above. Check if they represent actual active keys, credentials, or dangerous security vulnerabilities. If they are real/dangerous, list them in the 'security_risks' array. If they are just harmless unit test mocks, README documentation placeholders, or false positives, do NOT flag them as risks.\n"
            
            repo_context = repo_context + findings_str

        if prompt_template:
            formatted = prompt_template
            replacements = {
                "{job_title}": job_title,
                "{job_position}": job_position_str,
                "{jd_skills_str}": jd_skills_str,
                "{project_skills_str}": project_skills_str,
                "{repo_name}": repo_name,
                "{tech_stack}": json.dumps(tech_stack, indent=2),
                "{repo_context}": repo_context,
            }
            for k, v in replacements.items():
                formatted = formatted.replace(k, v)
            return formatted

        return f"""
You are an expert senior engineering evaluator.
Evaluate the following candidate repository and tech stack against the target job requirements.

JOB TITLE:
{job_title}

JOB POSITION (Max Seniority Level allowed):
{job_position_str}

JOB DESCRIPTION SKILLS TO EVALUATE:
{jd_skills_str}

PROJECT REQUIRED DOCUMENT SKILLS TO EVALUATE:
{project_skills_str}

REPOSITORY DETAILS:
Repository Name: {repo_name}
Detected Stack: {json.dumps(tech_stack, indent=2)}

REPOSITORY CONTEXT (Tree & Files):
{repo_context}

You must evaluate the repository and output a single, valid JSON object. Do not include any text before or after the JSON block.

You must score the following 6 categories on a scale of 0 to 5 (where 0 is completely missing/inadequate and 5 is outstanding/exceeds expectations):
1. correctness (e.g. is the code functional, does it meet core specs, does it handle edge cases, and is the algorithm logic sound and correct?)
2. code_quality (e.g. style, readability, simplicity, naming conventions, type hints?)
3. architecture (e.g. design patterns, modularity, SoC, separation of concerns, scalability?)
4. security (e.g. secret handling, input validation, dependency security, safe execution? When evaluating security, do not perform a strict 'hard check' or automatically default the score to 0.0 for minor/medium security issues. Do not check for or require advanced security measures; if basic or mid-level security practices like input validation, sanitization, basic authentication/authorization, or secure configs are available, this is considered good/satisfactory and should receive a high score without deductions for lack of enterprise-grade security.)
5. performance (e.g. scalability, resource efficiency, latency, caching, optimization, and time/space complexity of the implementation — evaluate: 1. if algorithm logic and time/space complexity are used/considered, and 2. if so, how good they are.)
6. documentation (e.g. README clarity, architecture diagrams, setup guides?)

SCORING BENCHMARK RULES:
- For every category, if the repository's implementation is satisfactory, standard, or acceptable, the maximum score you can give is 3.5. Scores above 3.5 (up to 5.0) are strictly reserved for exceptionally good, highly optimized, or advanced work. 
- ABSOLUTELY DO NOT give a perfect 5.0 in ANY category (Correctness, Architecture, Code Quality, Security, Performance, Documentation) just because a project is small, simple, or lacks obvious errors/vulnerabilities. The absence of errors does NOT equal a 5.0. To earn > 3.5, the codebase must actively demonstrate advanced capabilities or exceptional implementation. Do not inflate scores for basic satisfactory implementations.

LOGICAL CONSISTENCY AND CONTRADICTION RULES:
- The entire evaluation report must be logically consistent. Under no circumstances should different sections, reviews, or scores contradict each other.
- If a skill, tool, or feature is noted/analyzed as present, implemented, or used in one part of the report (e.g., in the jd_alignment, strengths, or stack detection), it must NOT be declared as missing, absent, or neglected in another part of the report (e.g., in the project_alignment, weaknesses, or reports). Both sections must align on whether a capability exists in the repository.
- Ensure that the global reviews (architecture_review, code_quality_review) align with the respective category scores and the specific alignment reviews.
- ABSOLUTE BAN ON CONTRADICTORY QUALIFIERS: If a file (like a README) or feature is empty or completely missing, you MUST ONLY describe it as "completely empty" or "non-existent". You are FORBIDDEN from using words like "minimal", "sparse", or "insufficient" to describe it. 
- WARNING: Saying "Documentation is minimal" when the README is empty is a logical hallucination. "Minimal" implies that some content exists. If there is NO content, you MUST say "Documentation is absent" or "Documentation is non-existent". Do NOT evaluate or summarize the contents of a missing or empty file.

Expected JSON structure:
{{
  "seniority_estimate": "Intern / Freshers / Intermediate / Senior",
  "recommendation": "Proceed / Reject",
  "security_risks": [
     "specific security vulnerability or risk identified in the codebase (e.g. exposed secrets, SQLi, CSRF, unsafe packages)"
  ],
  "architecture_review": "Repository-wide review of codebase architecture, organization, design patterns, modularity, and SoC.",
  "code_quality_review": "Repository-wide review of code quality, style, readability, simplicity, and formatting.",
  "jd_alignment_report": "Summary assessment of how the codebase files and implementation align with the JD skills listed above.",
  "project_alignment_report": "Summary assessment of how the codebase files and implementation align with the project required skills listed above.",
  "jd_alignment": {{
    "strengths": [
       "strength of the repository specifically matching the JD skills"
    ],
    "weaknesses": [
       "weakness / gap of the repository specifically in relation to the JD skills"
    ],
    "alignment_review": "Deep alignment analysis regarding how the candidate's codebase satisfies the JD skills ({jd_skills_str}).",
    "interview_questions": [
       "question challenging candidate on their choices and implementation of JD skills"
    ],
    "scores": {{
      "correctness": 3.0,
      "code_quality": 2.5,
      "architecture": 2.0,
      "security": 0.0,
      "performance": 3.0,
      "documentation": 2.5
    }},
    "correctness_review": "Detailed evaluation explaining on what basis the correctness score was given for JD alignment.",
    "code_quality_review": "Detailed evaluation explaining on what basis the code quality score was given for JD alignment.",
    "architecture_review": "Detailed evaluation explaining on what basis the architecture score was given for JD alignment.",
    "security_review": "Detailed evaluation explaining on what basis the security score was given for JD alignment.",
    "performance_review": "Detailed evaluation explaining on what basis the performance score was given for JD alignment.",
    "documentation_review": "Detailed evaluation explaining on what basis the documentation score was given for JD alignment."
  }},
  "project_alignment": {{
    "strengths": [
       "strength of the repository specifically matching the project required skills"
    ],
    "weaknesses": [
       "weakness / gap of the repository specifically in relation to the project required skills"
    ],
    "alignment_review": "Deep alignment analysis regarding how the candidate's codebase satisfies the project required skills ({project_skills_str}).",
    "interview_questions": [
       "question challenging candidate on their choices and implementation of project required skills"
    ],
    "scores": {{
      "correctness": 4.0,
      "code_quality": 3.5,
      "architecture": 3.7,
      "security": 3.0,
      "performance": 3.2,
      "documentation": 4.0
    }},
    "correctness_review": "Detailed evaluation explaining on what basis the correctness score was given for project required skills alignment.",
    "code_quality_review": "Detailed evaluation explaining on what basis the code quality score was given for project required skills alignment.",
    "architecture_review": "Detailed evaluation explaining on what basis the architecture score was given for project required skills alignment.",
    "security_review": "Detailed evaluation explaining on what basis the security score was given for project required skills alignment.",
    "performance_review": "Detailed evaluation explaining on what basis the performance score was given for project required skills alignment.",
    "documentation_review": "Detailed evaluation explaining on what basis the documentation score was given for project required skills alignment."
  }},
  "scores": {{
    "correctness": 4.0,
    "code_quality": 3.5,
    "architecture": 3.7,
    "security": 3.0,
    "performance": 3.2,
    "documentation": 4.0
  }},
  "extraordinary_points": [
     "any extraordinary points, unmentioned skills, or technologies (e.g., Redis, Celery, Docker, custom optimizations) used in the repository that were NOT explicitly listed in the requested JD skills ({jd_skills_str}) or project required skills ({project_skills_str}) but show exceptional capability"
  ]
}}
"""

    def _sanitize_contradictions(self, report_json: Dict[str, Any]) -> None:
        """Post-processing step to forcefully remove known LLM hallucinations where it calls missing features 'minimal'."""
        
        doc_score = report_json.get("scores", {}).get("documentation")
        is_doc_absent = False
        try:
            if doc_score is not None and float(doc_score) <= 0.0:
                is_doc_absent = True
        except (ValueError, TypeError):
            pass

        def replace_minimal(text: str) -> str:
            if not text or not isinstance(text, str):
                return text
            
            if is_doc_absent:
                text = text.replace("Documentation remains minimal", "Documentation is completely absent")
                text = text.replace("documentation remains minimal", "documentation is completely absent")
                text = text.replace("docstrings are sparse", "docstrings are completely absent")
                text = text.replace("Docstrings are sparse", "Docstrings are completely absent")
                text = text.replace("minimal documentation", "no documentation")
                text = text.replace("Minimal documentation", "No documentation")
            return text

        for key in ["jd_alignment_report", "project_alignment_report", "architecture_review", "code_quality_review"]:
            if key in report_json:
                report_json[key] = replace_minimal(report_json[key])
                
        for align_key in ["jd_alignment", "project_alignment"]:
            if align_key in report_json and isinstance(report_json[align_key], dict):
                align = report_json[align_key]
                for field in ["alignment_review", "correctness_review", "security_review", "performance_review", "documentation_review", "code_quality_review", "architecture_review"]:
                    if field in align:
                        align[field] = replace_minimal(align[field])
                        
        if "weaknesses" in report_json:
            report_json["weaknesses"] = [replace_minimal(w) for w in report_json["weaknesses"]]
        
        for align_key in ["jd_alignment", "project_alignment"]:
            if align_key in report_json and isinstance(report_json[align_key], dict) and "weaknesses" in report_json[align_key]:
                report_json[align_key]["weaknesses"] = [replace_minimal(w) for w in report_json[align_key]["weaknesses"]]

    async def evaluate_repository(
        self,
        repo_name: str,
        tech_stack: Dict[str, List[str]],
        repo_context: str,
        job_title: str,
        job_position: Optional[str] = None,
        jd_skills: Optional[List[str]] = None,
        project_required_skills: Optional[List[str]] = None,
        prompt_template: Optional[str] = None,
        tree_str: Optional[str] = None,
        content_str: Optional[str] = None,
        secrets_findings: Optional[List[Dict[str, Any]]] = None,
        bandit_findings: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Run LLM evaluation of repository context against the job description."""
        # 1. Determine contexts and prompts for code & non_code models
        if tree_str is not None and content_str is not None:
            from github_code_evaluator.app.v1.services.repo import RepositoryService
            repo_context_code = RepositoryService.prepare_evaluation_context(
                tree_str, content_str, filter_mode="code", lightweight=settings.EVALUATION_LIGHTWEIGHT_MODE
            )
            repo_context_non_code = RepositoryService.prepare_evaluation_context(
                tree_str, content_str, filter_mode="non_code", lightweight=settings.EVALUATION_LIGHTWEIGHT_MODE
            )
            
            prompt_code = self.build_prompt(
                repo_name=repo_name,
                tech_stack=tech_stack,
                repo_context=repo_context_code,
                job_title=job_title,
                job_position=job_position,
                jd_skills=jd_skills,
                project_required_skills=project_required_skills,
                prompt_template=prompt_template,
                secrets_findings=secrets_findings,
                bandit_findings=bandit_findings,
            )
            prompt_non_code = self.build_prompt(
                repo_name=repo_name,
                tech_stack=tech_stack,
                repo_context=repo_context_non_code,
                job_title=job_title,
                job_position=job_position,
                jd_skills=jd_skills,
                project_required_skills=project_required_skills,
                prompt_template=prompt_template,
                secrets_findings=secrets_findings,
                bandit_findings=bandit_findings,
            )
        else:
            # Fallback to single context if tree/content not provided
            prompt_code = self.build_prompt(
                repo_name=repo_name,
                tech_stack=tech_stack,
                repo_context=repo_context,
                job_title=job_title,
                job_position=job_position,
                jd_skills=jd_skills,
                project_required_skills=project_required_skills,
                prompt_template=prompt_template,
                secrets_findings=secrets_findings,
                bandit_findings=bandit_findings,
            )
            prompt_non_code = prompt_code

        model_non_code = getattr(settings, "LLM_MODEL_LOGIC", "gpt-oss:120b-cloud")
        model_code = settings.LLM_MODEL

        # Messages specializing the models
        messages_code = [
            {
                "role": "system",
                "content": (
                    "You are a strict technical evaluator. You must return only valid, "
                    "parsable JSON matching the exact schema requested.\n"
                    "Focus your evaluation ONLY on the technical analysis: the root-level 'scores' dictionary, 'security_risks', 'architecture_review', 'code_quality_review', 'architecture_score', 'code_quality_score', and 'security_score'. "
                    "For all other fields (seniority estimate, recommendation, jd_alignment, project_alignment, extraordinary_points, extraordinary_score), "
                    "you MUST still include the keys in the JSON to respect the schema, but you can provide dummy/placeholder values (e.g. empty strings/lists for reviews/text, or 0.0 for scores)."
                ),
            },
            {"role": "user", "content": prompt_code},
        ]

        messages_non_code = [
            {
                "role": "system",
                "content": (
                    "You are a strict technical evaluator. You must return only valid, "
                    "parsable JSON matching the exact schema requested.\n"
                    "Focus your evaluation ONLY on jd_alignment, project_alignment, seniority estimate, recommendation, extraordinary_points, and extraordinary_score. "
                    "For the 6 main category scores (correctness, code_quality, architecture, security, performance, documentation) inside the main 'scores' dict, as well as architecture_score, code_quality_score, and security_score, "
                    "you MUST still include the keys in the JSON to respect the schema, but you can provide dummy/placeholder values (e.g. 0.0)."
                ),
            },
            {"role": "user", "content": prompt_non_code},
        ]

        logger.info(f"Running parallel evaluation with {model_code} (code) and {model_non_code} (non-code)...")

        async def run_code():
            try:
                response_text = await self.call_llm(messages_code, model=model_code)
                return self.parse_json_safely(response_text)
            except Exception as e:
                err_str = str(e).lower()
                # Check for context limit or prompt too long errors to trigger fallback
                if "too long" in err_str or "context length" in err_str or "limit" in err_str or "400" in err_str:
                    logger.warning(
                        f"Code evaluation model {model_code} failed due to context limit error: {e}. "
                        f"Attempting fallback evaluation with logic model {model_non_code}..."
                    )
                    response_text = await self.call_llm(messages_code, model=model_non_code)
                    return self.parse_json_safely(response_text)
                raise e

        async def run_non_code():
            response_text = await self.call_llm(messages_non_code, model=model_non_code)
            return self.parse_json_safely(response_text)

        report_code, report_non_code = await asyncio.gather(run_code(), run_non_code())

        # Merge the two reports
        final_report = self.combine_reports(report_code, report_non_code)
        
        # Sanitize known LLM linguistic hallucinations forcefully
        self._sanitize_contradictions(final_report)

        return final_report

    def combine_reports(self, report_code: Dict[str, Any], report_non_code: Dict[str, Any]) -> Dict[str, Any]:
        """Combine correctness, code_quality, architecture, security, performance, and documentation from report_code, and the rest from report_non_code."""
        combined = {}
        
        # Root level fields from report_non_code
        for key in ["seniority_estimate", "recommendation", "jd_alignment_report", "project_alignment_report", "extraordinary_points"]:
            combined[key] = report_non_code.get(key)

        # Programmatic fallback for extraordinary_score if there are extraordinary points
        extra_pts = [p for p in (combined.get("extraordinary_points") or []) if p and str(p).strip()]
        extra_scr = report_non_code.get("extraordinary_score")
        try:
            extra_scr_val = float(extra_scr) if extra_scr is not None else 0.0
        except (ValueError, TypeError):
            extra_scr_val = 0.0

        if extra_pts and extra_scr_val == 0.0:
            extra_scr_val = min(5.0, 2.0 + len(extra_pts) * 1.0)
        
        combined["extraordinary_score"] = max(0.0, min(5.0, extra_scr_val))
            
        # Root level fields from report_code
        for key in ["security_risks", "architecture_review", "code_quality_review"]:
            combined[key] = report_code.get(key)
            
        for score_key in ["architecture_score", "code_quality_score", "security_score"]:
            val = report_code.get(score_key)
            try:
                val_float = float(val) if val is not None else 0.0
            except (ValueError, TypeError):
                val_float = 0.0
            combined[score_key] = max(0.0, min(5.0, val_float))
            
        # Scores combined
        combined["scores"] = {}
        for cat in ["correctness", "code_quality", "architecture", "security", "performance", "documentation"]:
            val = report_code.get("scores", {}).get(cat)
            try:
                val_float = float(val) if val is not None else 0.0
            except (ValueError, TypeError):
                val_float = 0.0
            combined["scores"][cat] = max(0.0, min(5.0, val_float))
        
        # Alignment reports
        for align_key in ["jd_alignment", "project_alignment"]:
            code_align = report_code.get(align_key, {})
            non_code_align = report_non_code.get(align_key, {})
            
            align_scores = {}
            for cat in ["correctness", "code_quality", "architecture", "security", "performance", "documentation"]:
                val = non_code_align.get("scores", {}).get(cat)
                try:
                    val_float = float(val) if val is not None else 0.0
                except (ValueError, TypeError):
                    val_float = 0.0
                align_scores[cat] = max(0.0, min(5.0, val_float))
                
            combined[align_key] = {
                "strengths": non_code_align.get("strengths", []),
                "weaknesses": non_code_align.get("weaknesses", []),
                "alignment_review": non_code_align.get("alignment_review", ""),
                "interview_questions": non_code_align.get("interview_questions", []),
                "decision": non_code_align.get("decision", "Proceed"),
                "scores": align_scores,
                "correctness_review": non_code_align.get("correctness_review", ""),
                "code_quality_review": non_code_align.get("code_quality_review", ""),
                "architecture_review": non_code_align.get("architecture_review", ""),
                "security_review": non_code_align.get("security_review", ""),
                "performance_review": non_code_align.get("performance_review", ""),
                "documentation_review": non_code_align.get("documentation_review", ""),
            }
            
            # Preserve extra keys if they exist (like jd_skills/project_required_skills)
            for extra_key in ["jd_skills", "project_required_skills"]:
                if extra_key in non_code_align:
                    combined[align_key][extra_key] = non_code_align[extra_key]
                    
        return combined


llm_eval_service = LLMEvaluationService()


def cap_seniority_estimate(job_position: Optional[str], estimated_level: str) -> str:
    """Cap estimated seniority level based on the provided job position."""
    if not job_position:
        return estimated_level
    LEVEL_RANKS = {
        "intern": 0,
        "fresher": 0,
        "freshers": 0,
        "junior": 1,
        "intermediate": 2,
        "mid-level": 2,
        "mid": 2,
        "senior": 3,
        "lead": 4,
        "staff": 5
    }

    NORM_LEVELS = {
        0: "Intern / Fresher",
        1: "Junior",
        2: "Intermediate",
        3: "Senior",
        4: "Lead",
        5: "Staff"
    }

    position_lower = (job_position or "").lower()
    target_rank = 2  # Default target is Mid-level if no keyword matches
    if "intern" in position_lower or "fresher" in position_lower:
        target_rank = 0
    elif "junior" in position_lower:
        target_rank = 1
    elif "staff" in position_lower:
        target_rank = 5
    elif "lead" in position_lower:
        target_rank = 4
    elif "senior" in position_lower:
        target_rank = 3
    elif "intermediate" in position_lower or "mid" in position_lower:
        target_rank = 2
        
    est_lower = (estimated_level or "").lower().strip()
    # Normalize some common strings
    if "mid" == est_lower:
        est_lower = "mid-level"
    elif "freshers" == est_lower or "intern" == est_lower:
        est_lower = "fresher"
    
    est_rank = LEVEL_RANKS.get(est_lower, 2)
    
    if est_rank > target_rank:
        return NORM_LEVELS[target_rank]
        
    return NORM_LEVELS.get(est_rank, estimated_level)

