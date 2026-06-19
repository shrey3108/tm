from fastapi import Request
from slowapi import Limiter
import jwt
from typing import Optional

from app.v1.core.config import settings

def _get_user_or_ip(request: Request) -> str:
    """
    Extracts the user ID from the JWT token in the Authorization header.
    If no valid token is found, falls back to the client's IP address.
    """
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            # We only decode to extract the subject (user ID) for rate limiting.
            # Security verification is handled properly by the auth dependency later.
            payload = jwt.decode(token, options={"verify_signature": False})
            user_id = payload.get("sub")
            if user_id:
                return f"user:{user_id}"
        except jwt.PyJWTError:
            pass

    # Fallback to IP address
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return f"ip:{forwarded.split(',')[0].strip()}"
    return f"ip:{request.client.host}" if request.client else "ip:127.0.0.1"


# Initialize the Limiter using Redis as the storage backend so rate limits
# are shared across all Gunicorn/Uvicorn workers.
limiter = Limiter(
    key_func=_get_user_or_ip,
    default_limits=["10/minute"],
    storage_uri=settings.REDIS_URL,
)
