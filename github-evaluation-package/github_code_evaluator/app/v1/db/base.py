"""
Base class module.

This module imports all database models and registers them with the SQLAlchemy metadata
for tracking and Alembic migration creation.
"""

from github_code_evaluator.app.v1.db.base_class import Base  # noqa: F401

# Import all models here to register them with SQLAlchemy metadata
from github_code_evaluator.app.v1.db.models.repository import Repository  # noqa: F401
from github_code_evaluator.app.v1.db.models.evaluation import Evaluation  # noqa: F401
from github_code_evaluator.app.v1.db.models.score import EvaluationScore  # noqa: F401
from github_code_evaluator.app.v1.db.models.report import EvaluationReport  # noqa: F401
from github_code_evaluator.app.v1.db.models.security_result import SecurityResult  # noqa: F401
from github_code_evaluator.app.v1.db.models.role_config import RoleWeightConfig  # noqa: F401
from github_code_evaluator.app.v1.db.models.override_log import ReviewerOverrideLog  # noqa: F401
from github_code_evaluator.app.v1.db.models.prompt import PromptEvaluation  # noqa: F401
from github_code_evaluator.app.v1.db.models.category import Category  # noqa: F401


