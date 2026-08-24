"""
SQLAlchemy Base.
"""

from sqlalchemy.orm import DeclarativeBase

from v1.core.config import settings

class Base(DeclarativeBase):
     __table_args__ = {"schema": settings.DB_SCHEMA}
