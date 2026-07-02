from sqlalchemy import Column, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID

from app.v1.db.base_class import Base

# Junction table for many-to-many relationship between Job and Associate
job_associates = Table(
    "job_associates",
    Base.metadata,
    Column(
        "job_id",
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    ),
    Column(
        "associate_id",
        UUID(as_uuid=True),
        ForeignKey("associates.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    ),
)
