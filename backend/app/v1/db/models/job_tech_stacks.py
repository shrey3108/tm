from sqlalchemy import Column, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID

from app.v1.db.base_class import Base

# Junction table for many-to-many relationship between Job and TechStack
# A single job can require multiple tech stacks
# A single tech stack can appear in multiple jobs
job_tech_stacks = Table(
    "job_tech_stacks",
    Base.metadata,
    # FOREIGN KEYS
    Column(
        "job_id",
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    ),
    Column(
        "tech_stack_id",
        UUID(as_uuid=True),
        ForeignKey("tech_stacks.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    ),
)
