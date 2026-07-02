"""
Repository for guideline-related database operations.
"""

from fastcrud import FastCRUD

from app.v1.db.models.guidelines import Guideline


class GuidelineRepository:
    """
    Repository class for handling Guideline database operations using FastCRUD.
    """

    def __init__(self) -> None:
        """
        Initialize the GuidelineRepository with FastCRUD.
        """
        self.crud = FastCRUD(Guideline)


guideline_repository = GuidelineRepository()
