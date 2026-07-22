from uuid import UUID
from uuid_utils import uuid7
from typing import Union


def generate_uuid7() -> UUID:
    """Generate a new UUID7 as stdlib uuid.UUID (psycopg3 compatible)."""
    return UUID(str(uuid7()))          # ← wrap with UUID(str(...))


def generate_uuid7_str() -> str:
    """Generate a new UUID7 as a string."""
    return str(uuid7())


def is_valid_uuid(uuid_str: str) -> bool:
    """Check if a string is a valid UUID."""
    try:
        UUID(uuid_str)
        return True
    except (ValueError, AttributeError):
        return False


def uuid_to_str(uuid_obj: Union[UUID, str]) -> str:
    """Convert UUID object to string, or return string as-is."""
    if isinstance(uuid_obj, UUID):
        return str(uuid_obj)
    return uuid_obj


def str_to_uuid(uuid_str: str) -> UUID:
    """Convert string to UUID object."""
    return UUID(uuid_str)