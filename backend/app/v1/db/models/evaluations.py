import uuid
import json
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.v1.db.base_class import Base
from app.v1.utils.uuid import UUIDHelper

if TYPE_CHECKING:
    from app.v1.db.models.interviews import Interview
    from app.v1.db.models.transcripts import Transcript
    from app.v1.db.models.candidate_stages import CandidateStage


class Evaluation(Base):
    """Evaluation ORM model.

    Stores AI agent evaluations and manual HR form evaluation outputs.
    Records strict JSON outputs based on dynamic criteria.
    """

    __tablename__ = "evaluations"

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    # FOREIGN KEYS
    interview_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("interviews.id", ondelete="SET NULL"),
        nullable=True,
    )

    transcript_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transcripts.id", ondelete="SET NULL"),
        nullable=True,
    )

    # THIS TELLS WHICH CANDIDATE STAGE WE ARE EVALUATING (Stage 1, 2, etc.)
    candidate_stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidate_stages.id", ondelete="CASCADE"),
        nullable=False,
    )

    attempt_number: Mapped[int] = mapped_column(
        default=1,
        nullable=False,
    )

    passing_threshold: Mapped[float] = mapped_column(
        Numeric(5, 2),
        default=3.5,
    )

    result: Mapped[str] = mapped_column(
        Text,
        default="fail",
    )

    # EVALUATION FIELDS
    evaluation_data: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
    )

    overall_score: Mapped[float | None] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )

    recommendation: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # SIMILARITY SCORES
    sim_jd_resume: Mapped[float | None] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    sim_jd_transcript: Mapped[float | None] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    sim_resume_transcript: Mapped[float | None] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    evidence_block: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    # TIMESTAMPS
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # RELATIONSHIPS
    interview: Mapped[Optional["Interview"]] = relationship("Interview", foreign_keys=[interview_id])
    transcript: Mapped[Optional["Transcript"]] = relationship("Transcript", foreign_keys=[transcript_id])
    candidate_stage: Mapped["CandidateStage"] = relationship("CandidateStage", foreign_keys=[candidate_stage_id])

    def _get_full_highlights(self) -> dict | None:
        """Parses the highlights, with backward compatibility for old formats."""
        # 1. Try parsing recommendation column (New format stores JSON here)
        data = None
        if self.recommendation:
            try:
                data = json.loads(self.recommendation)
            except (json.JSONDecodeError, TypeError):
                pass

        # 2. Try pulling from evaluation_data (Old format stored everything there)
        if not (isinstance(data, dict) and "overall_summary" in data):
            if isinstance(self.evaluation_data, dict) and ("strengths" in self.evaluation_data or "criteria" in self.evaluation_data):
                data = {
                    "strengths": self.evaluation_data.get("strengths", []),
                    "weaknesses": self.evaluation_data.get("weaknesses", []),
                    "suggested_followups": self.evaluation_data.get("suggested_followups", []),
                    "overall_summary": self.evaluation_data.get("overall_summary", self.recommendation),
                    "recommendation": f"{self.result.upper()} - {self.evaluation_data.get('overall_summary', self.recommendation)}",
                }

        # 3. Fallback for very old or manual records
        if not isinstance(data, dict):
            data = {
                "strengths": [],
                "weaknesses": [],
                "suggested_followups": [],
                "overall_summary": self.recommendation,
                "recommendation": f"{self.result.upper()} - {self.recommendation}",
            }

        # Clean highlights to remove symbols/emojis and fix formatting for both old and new records
        if isinstance(data, dict):
            summary = data.get("overall_summary") or ""
            if isinstance(summary, str) and summary.strip():
                # Remove emojis and symbols
                symbols_to_remove = ["❌", "✅", "📐", "⚠️", "✨", "📌", "🎯"]
                for sym in symbols_to_remove:
                    summary = summary.replace(sym, "")
                
                if "──" in summary:
                    parts = summary.split("──")
                    structured_summary = []
                    for part in parts:
                        part_str = part.strip()
                        if "Job Description (JD):" in part_str or "ALIGNMENT BREAKDOWN: Job Description (JD):" in part_str:
                            clean_text = part_str.replace("ALIGNMENT BREAKDOWN:", "").replace("Job Description (JD):", "").strip()
                            structured_summary.append({"JD Alignment": clean_text})
                        elif "Task/Project:" in part_str:
                            clean_text = part_str.replace("Task/Project:", "").strip()
                            structured_summary.append({"Project Requirements": clean_text})
                        elif "Architecture:" in part_str:
                            clean_text = part_str.replace("Architecture:", "").strip()
                            structured_summary.append({"Architecture": clean_text})
                        elif "Code Quality:" in part_str:
                            clean_text = part_str.replace("Code Quality:", "").strip()
                            structured_summary.append({"Code Quality": clean_text})
                        elif "Security Risks:" in part_str:
                            clean_text = part_str.replace("Security Risks:", "").strip()
                            structured_summary.append({"Security Risks": clean_text})
                        elif part_str:
                            structured_summary.append({"Summary": part_str})
                    
                    if structured_summary:
                        data["overall_summary"] = structured_summary
                else:
                    lines = [line.strip() for line in summary.split("\n") if line.strip()]
                    cleaned_summary = " ── ".join(lines)
                    while "  " in cleaned_summary:
                        cleaned_summary = cleaned_summary.replace("  ", " ")
                    while " ── ── " in cleaned_summary:
                        cleaned_summary = cleaned_summary.replace(" ── ── ", " ── ")
                    while "====" in cleaned_summary:
                        cleaned_summary = cleaned_summary.replace("====", "")
                    data["overall_summary"] = cleaned_summary.strip(" -=")

            # Clean and group list strengths, weaknesses, followups
            for key in ["strengths", "weaknesses", "suggested_followups"]:
                items = data.get(key) or []
                
                # Check if any item contains "[JD Alignment]" or "[Project Requirements]"
                has_alignment = any(isinstance(item, str) and ("[JD Alignment]" in item or "[Project Requirements]" in item) for item in items)
                
                if not has_alignment:
                    cleaned_items = []
                    for item in items:
                        if isinstance(item, str):
                            trimmed = item.strip()
                            if trimmed.startswith("[") and trimmed.endswith("]") and ("Strengths" in trimmed or "Weaknesses" in trimmed or "Followup" in trimmed):
                                continue
                            for sym in ["❌", "✅", "📐", "⚠️", "✨", "📌", "🎯"]:
                                item = item.replace(sym, "")
                            cleaned_items.append(item.strip())
                    data[key] = cleaned_items
                else:
                    jd_items = []
                    proj_items = []
                    for item in items:
                        if isinstance(item, str):
                            trimmed = item.strip()
                            if trimmed.startswith("[") and trimmed.endswith("]") and ("Strengths" in trimmed or "Weaknesses" in trimmed or "Followup" in trimmed):
                                continue
                            for sym in ["❌", "✅", "📐", "⚠️", "✨", "📌", "🎯"]:
                                trimmed = trimmed.replace(sym, "")
                            trimmed = trimmed.strip()
                            
                            if "[JD Alignment]" in trimmed:
                                clean_text = trimmed.replace("[JD Alignment]", "").strip()
                                jd_items.append(clean_text)
                            elif "[Project Requirements]" in trimmed:
                                clean_text = trimmed.replace("[Project Requirements]", "").strip()
                                proj_items.append(clean_text)
                            else:
                                jd_items.append(trimmed)
                    
                    if key == "suggested_followups" or key == "strengths" or key == "weaknesses":
                        data[key] = [
                            {"JD Alignment": jd_items},
                            {"Project Requirements": proj_items}
                        ]

        return data

    @property
    def highlights(self) -> dict | None:
        """Returns the parsed highlights, but clears strengths, weaknesses, and followups to avoid duplication in UI if they are injected into JD/Task skills grids."""
        full = self._get_full_highlights()
        if not full:
            return None
        res = full.copy()
        
        # Only clear them if this is a GitHub Evaluation (which has grouped skills)
        if isinstance(self.evaluation_data, dict) and any("(JD Skills)" in k or "(Task Skills)" in k for k in self.evaluation_data.keys()):
            res["strengths"] = []
            res["weaknesses"] = []
            res["suggested_followups"] = []
            if "overall_summary" in res:
                del res["overall_summary"]
            if "recommendation" in res:
                del res["recommendation"]
            
        return res

    @property
    def jd_skills(self) -> list[str] | None:
        if isinstance(self.evidence_block, dict):
            if "jd_alignment" in self.evidence_block and isinstance(self.evidence_block["jd_alignment"], dict):
                return self.evidence_block["jd_alignment"].get("jd_skills")
        return None

    @property
    def project_required_skills(self) -> list[str] | None:
        if isinstance(self.evidence_block, dict):
            if "project_alignment" in self.evidence_block and isinstance(self.evidence_block["project_alignment"], dict):
                return self.evidence_block["project_alignment"].get("project_required_skills")
        return None

    @property
    def structured_evaluation_data(self) -> dict:
        """Ensures evaluation_data only returns the criteria map, with evidence injected for old records."""
        if not isinstance(self.evaluation_data, dict):
            return {}
        
        # Determine the criteria map
        criteria = {}
        if "criteria" in self.evaluation_data:
            # Old format
            criteria = self.evaluation_data["criteria"]
        else:
            # New format
            criteria = self.evaluation_data

        # If it's a dictionary, ensure each criterion has confidence and evidence
        if isinstance(criteria, dict):
            # Try to inject evidence from evidence_block if it's missing in the criterion
            for key, details in criteria.items():
                if isinstance(details, dict):
                    # Default confidence if missing
                    if "confidence" not in details:
                        details["confidence"] = 0.0
                    
                    # Inject evidence if missing or empty
                    if not details.get("evidence"):
                        if isinstance(self.evidence_block, dict):
                            # Match name (snake_case key vs Title Case evidence_block key)
                            for ev_name, snippets in self.evidence_block.items():
                                if ev_name.lower().replace(" ", "_") == key:
                                    details["evidence"] = snippets
                                    break
                        
                        # Final fallback if still missing
                        if "evidence" not in details:
                            details["evidence"] = []

        # Check if there are keys matching "(JD Skills)" or "(Task Skills)"
        has_grouped_skills = any("(JD Skills)" in k or "(Task Skills)" in k for k in criteria.keys())
        
        if has_grouped_skills:
            jd_skills_list = []
            task_skills_list = []
            
            # We want to preserve the order:
            ordered_base_names = [
                "performance",
                "architecture",
                "code_quality",
                "correctness",
                "security",
                "documentation"
            ]
            
            # Group by category
            for base_name in ordered_base_names:
                jd_key = f"{base_name} (JD Skills)"
                task_key = f"{base_name} (Task Skills)"
                
                if jd_key in criteria:
                    jd_skills_list.append({base_name: criteria[jd_key]})
                if task_key in criteria:
                    task_skills_list.append({base_name: criteria[task_key]})
                    
            # Fallback for any other custom keys that contain (JD Skills) or (Task Skills)
            for k, v in criteria.items():
                if "(JD Skills)" in k:
                    base_name = k.replace(" (JD Skills)", "").strip()
                    # Check if already added
                    if not any(base_name in item for item in jd_skills_list):
                        jd_skills_list.append({base_name: v})
                elif "(Task Skills)" in k:
                    base_name = k.replace(" (Task Skills)", "").strip()
                    # Check if already added
                    if not any(base_name in item for item in task_skills_list):
                        task_skills_list.append({base_name: v})

            # Retrieve highlights and extract strengths, weaknesses, suggested_followups
            highlights = self._get_full_highlights()
            jd_strengths = []
            task_strengths = []
            jd_weaknesses = []
            task_weaknesses = []
            combined_followups = []
            jd_summary = ""
            task_summary = ""

            if isinstance(highlights, dict):
                # Extract overall_summary
                overall_summary = highlights.get("overall_summary")
                if isinstance(overall_summary, list):
                    for item in overall_summary:
                        if isinstance(item, dict):
                            if "JD Alignment" in item:
                                jd_summary = item["JD Alignment"]
                            elif "Project Requirements" in item:
                                task_summary = item["Project Requirements"]
                elif isinstance(overall_summary, str):
                    jd_summary = overall_summary
                    task_summary = overall_summary

                # Extract strengths
                strengths = highlights.get("strengths") or []
                if strengths and isinstance(strengths[0], dict):
                    for item in strengths:
                        if "JD Alignment" in item:
                            jd_strengths = item["JD Alignment"]
                        elif "Project Requirements" in item:
                            task_strengths = item["Project Requirements"]
                else:
                    jd_strengths = strengths

                # Extract weaknesses
                weaknesses = highlights.get("weaknesses") or []
                if weaknesses and isinstance(weaknesses[0], dict):
                    for item in weaknesses:
                        if "JD Alignment" in item:
                            jd_weaknesses = item["JD Alignment"]
                        elif "Project Requirements" in item:
                            task_weaknesses = item["Project Requirements"]
                else:
                    jd_weaknesses = weaknesses

                # Extract suggested_followups
                jd_followups = []
                task_followups = []
                followups = highlights.get("suggested_followups") or []
                if followups and isinstance(followups[0], dict):
                    for item in followups:
                        if "JD Alignment" in item:
                            jd_followups = item["JD Alignment"]
                        elif "Project Requirements" in item:
                            task_followups = item["Project Requirements"]
                else:
                    jd_followups = followups
                    task_followups = followups

            # Append alignment_review, strengths, weaknesses, and suggested_followups directly to the respective lists
            jd_skills_list.append({"alignment_review": jd_summary})
            jd_skills_list.append({"strengths": jd_strengths})
            jd_skills_list.append({"weaknesses": jd_weaknesses})
            jd_skills_list.append({"suggested_followups": jd_followups})
            
            task_skills_list.append({"alignment_review": task_summary})
            task_skills_list.append({"strengths": task_strengths})
            task_skills_list.append({"weaknesses": task_weaknesses})
            task_skills_list.append({"suggested_followups": task_followups})

            return {
                "JD Skills": jd_skills_list,
                "Project requirements skills": task_skills_list
            }

        # Sort/order keys to guarantee perfect side-by-side grid alignment (PostgreSQL JSONB scrambles insertion order)
        ordered_keys = [
            "performance",
            "performance (JD Skills)",
            "performance (Task Skills)",
            
            "architecture",
            "architecture (JD Skills)",
            "architecture (Task Skills)",
            
            "code_quality",
            "code_quality (JD Skills)",
            "code_quality (Task Skills)",
            
            "correctness",
            "correctness (JD Skills)",
            "correctness (Task Skills)",
            
            "security",
            "security (JD Skills)",
            "security (Task Skills)",
            
            "documentation",
            "documentation (JD Skills)",
            "documentation (Task Skills)"
        ]
        
        sorted_criteria = {}
        # First, add the ordered keys in the perfect alternating sequence
        for k in ordered_keys:
            if k in criteria:
                sorted_criteria[k] = criteria[k]
                
        # Then, add any other keys that were not in our predefined list (fail-safe)
        for k, v in criteria.items():
            if k not in sorted_criteria:
                sorted_criteria[k] = v
                
        return sorted_criteria
