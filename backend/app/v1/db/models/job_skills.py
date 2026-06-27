from sqlalchemy import Column, ForeignKey, Table, Float
from sqlalchemy.dialects.postgresql import UUID

from app.v1.db.base_class import Base

# Junction table for many-to-many relationship between Job and Skill
# A single job can require multiple skills
# A single skill can appear in multiple jobs
job_skills = Table(
    "job_skills",
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
        "skill_id",
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    ),
    Column(
        "weightage",
        Float,
        nullable=True,
        default=10.0,
    ),
)
