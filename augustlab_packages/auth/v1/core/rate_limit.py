import os
from slowapi import Limiter
from slowapi.util import get_remote_address

from v1.core.config import settings

REDIS_URL = settings.REDIS_URL

if not REDIS_URL:
    raise RuntimeError("REDIS_URL must be set for rate limiting")

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=REDIS_URL,
    default_limits=[settings.RATE_LIMIT_DEFAULT],
)
