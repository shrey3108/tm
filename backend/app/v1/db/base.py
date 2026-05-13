"""
Base class module.

This module defines the SQLAlchemy DeclarativeBase class that all
ORM models inherit from.
"""

from app.v1.db.base_class import Base  # noqa: F401

# Import all models here to register them with SQLAlchemy metadata
from app.v1.db.models.user import User  # noqa: F401
from app.v1.db.models.jobs import Job  # noqa: F401
from app.v1.db.models.candidates import Candidate  # noqa: F401
from app.v1.db.models.resumes import Resume  # noqa: F401
from app.v1.db.models.cross_job_matches import CrossJobMatch  # noqa: F401
from app.v1.db.models.hr_decisions import HrDecision  # noqa: F401
from app.v1.db.models.resume_version_results import ResumeVersionResult  # noqa: F401
from app.v1.db.models.stage_templates import StageTemplate  # noqa: F401
from app.v1.db.models.job_stage_configs import JobStageConfig  # noqa: F401
from app.v1.db.models.candidate_stages import CandidateStage  # noqa: F401
from app.v1.db.models.criteria import Criterion  # noqa: F401
from app.v1.db.models.stage_template_criteria import StageTemplateCriterion  # noqa: F401
from app.v1.db.models.evaluations import Evaluation  # noqa: F401
from app.v1.db.models.transcript_chunks import TranscriptChunk  # noqa: F401
from app.v1.db.models.job_priorities import JobPriority  # noqa: F401
from app.v1.db.models.job_positions import JobPosition  # noqa: F401
from app.v1.db.models.system_settings import SystemSetting  # noqa: F401
