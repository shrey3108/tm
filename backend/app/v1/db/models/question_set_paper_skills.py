from sqlalchemy import Column, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID

from app.v1.db.base_class import Base

# Junction table for many-to-many relationship between QuestionSetPaper and Skill
# A single paper can contain questions covering multiple skills
# A single skill can be tested in multiple papers
question_set_paper_skills = Table(
    "question_set_paper_skills",
    Base.metadata,
    Column(
        "question_set_paper_id",
        UUID(as_uuid=True),
        ForeignKey("question_set_papers.id", ondelete="CASCADE"),
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
)
