"""
Repository for associate-related database operations.
"""

from fastcrud import FastCRUD

from app.v1.db.models.associates import Associate


class AssociateRepository:
    """
    Repository class for handling Associate database operations using FastCRUD.
    """

    def __init__(self) -> None:
        """
        Initialize the AssociateRepository with FastCRUD.
        """
        self.crud = FastCRUD(Associate)


associate_repository = AssociateRepository()
