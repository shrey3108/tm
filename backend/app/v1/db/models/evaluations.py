import uuid
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

    @property
    def highlights(self) -> dict | None:
        """Parses the highlights, with backward compatibility for old formats."""
        # 1. Try parsing recommendation column (New format stores JSON here)
        data = None
        if self.recommendation:
            try:
                import json
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
                    
                    data[key] = [
                        {"JD Alignment": jd_items},
                        {"Project Requirements": proj_items}
                    ]

        return data

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
                "Debug approach",
                "Logical thinking",
                "Code structure clarity",
                "Problem-solving ability",
                "Implementation accuracy",
                "Security compliance",
                "Documentation quality"
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
                        
            return {
                "JD Skills": jd_skills_list,
                "Task Skills": task_skills_list
            }

        # Sort/order keys to guarantee perfect side-by-side grid alignment (PostgreSQL JSONB scrambles insertion order)
        ordered_keys = [
            "Debug approach (JD Skills)",
            "Debug approach (Task Skills)",
            
            "Logical thinking (JD Skills)",
            "Logical thinking (Task Skills)",
            
            "Code structure clarity (JD Skills)",
            "Code structure clarity (Task Skills)",
            
            "Problem-solving ability (JD Skills)",
            "Problem-solving ability (Task Skills)",
            
            "Implementation accuracy (JD Skills)",
            "Implementation accuracy (Task Skills)",
            
            "Security compliance (JD Skills)",
            "Security compliance (Task Skills)",
            
            "Documentation quality (JD Skills)",
            "Documentation quality (Task Skills)"
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
