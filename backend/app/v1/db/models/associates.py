"""
Associate ORM model.

Represents an associate (external collaborator / interviewer / panelist)
in the hiring platform.
"""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.v1.db.base_class import Base
from app.v1.utils.uuid import UUIDHelper

if TYPE_CHECKING:
    from app.v1.db.models.jobs import Job
from app.v1.db.models.job_associates import job_associates


class Associate(Base):
    """Associate ORM model.

    Represents an associate in the hiring platform.

    Attributes:
        id: The primary key of the associate (UUID7).
        name: The full name of the associate (not null).
        email: The unique email address of the associate (not null).
    """

    __tablename__ = "associates"

    # PRIMARY KEY
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=UUIDHelper.generate_uuid7,
    )

    # ASSOCIATE FIELDS
    name: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    email: Mapped[str] = mapped_column(
        Text,
        unique=True,
        nullable=False,
    )

    jobs: Mapped[list["Job"]] = relationship(
        "Job",
        secondary=job_associates,
        back_populates="associates",
    )

