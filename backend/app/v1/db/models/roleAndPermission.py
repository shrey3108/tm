from sqlalchemy import Column, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID

from app.v1.db.base_class import Base

# Junction table for many-to-many relationship between Role and Permission
role_permission = Table(
    "roleAndPermission",
    Base.metadata,
    # FOREIGN KEYS
    Column(
        "permission_id",
        UUID(as_uuid=True),
        ForeignKey("permissions.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    ),
    Column(
        "role_id",
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    ),
)
