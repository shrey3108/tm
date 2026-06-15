"""
Base class module.

This module defines the SQLAlchemy DeclarativeBase class that all
ORM models inherit from.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models.

    All database models should inherit from this class to ensure
    proper table creation and metadata management.
    """

    pass
