import os
import struct
import time
import uuid
from typing import Optional


class UUIDHelper:
    """
    Utility class for UUID operations, specifically handling UUID v7.
    """

    @staticmethod
    def generate_uuid7() -> uuid.UUID:
        """
        Generates a UUID v7 (time-ordered UUID).

        Returns:
            uuid.UUID: A new UUID v7 object.
        """
        # uuid.uuid7() is available in Python 3.14+
        if hasattr(uuid, "uuid7"):
            return uuid.uuid7()

        # Pure Python fallback matching RFC 9562 for Python < 3.14
        
        # 48-bit timestamp (milliseconds since epoch)
        timestamp_ms = int(time.time() * 1000)
        timestamp_bytes = struct.pack(">Q", timestamp_ms)[2:]  # 6 bytes

        # Generate 10 random bytes
        rand_bytes = os.urandom(10)

        # Version 7: set 4 bits of version to 0111 (0x7)
        ver_and_rand = (rand_bytes[0] & 0x0F) | 0x70

        # Variant: set 2 bits of variant to 10xx (0x80)
        var_and_rand = (rand_bytes[2] & 0x3F) | 0x80

        # Assemble the 16-byte UUID
        uuid_bytes = (
            timestamp_bytes +
            bytes([ver_and_rand, rand_bytes[1]]) +
            bytes([var_and_rand]) +
            rand_bytes[3:]
        )

        return uuid.UUID(bytes=uuid_bytes)

    @staticmethod
    def to_string(u: uuid.UUID) -> str:
        """
        Converts a UUID object to its canonical string representation.

        Args:
            u (uuid.UUID): The UUID object to convert.

        Returns:
            str: The string representation of the UUID.
        """
        return str(u)

    @staticmethod
    def validate_uuid(uuid_to_test: Optional[str]) -> bool:
        """
        Validates whether a given string is a valid UUID.

        Args:
            uuid_to_test (str): The string to validate.

        Returns:
            bool: True if the string is a valid UUID, False otherwise.
        """
        if not uuid_to_test:
            return False
        try:
            uuid.UUID(str(uuid_to_test))
            return True
        except (ValueError, TypeError, AttributeError):
            return False
