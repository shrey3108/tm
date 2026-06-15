import json
import logging
from typing import Any, Optional

import redis.asyncio as aioredis

from github_code_evaluator.app.v1.core.config import settings

logger = logging.getLogger(__name__)


class RedisCacheService:
    """Redis cache wrapper service providing asynchronous get/set/delete capabilities."""

    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self.client: Optional[aioredis.Redis] = None

    def get_client(self) -> aioredis.Redis:
        """Retrieve or initialize the async Redis client."""
        if self.client is None:
            self.client = aioredis.from_url(
                self.redis_url, encoding="utf-8", decode_responses=True
            )
        return self.client

    async def get(self, key: str) -> Optional[Any]:
        """Fetch value from cache. Decodes JSON content if serialized.

        Args:
            key: Cache key.

        Returns:
            Any: Decoded object or None.
        """
        try:
            client = self.get_client()
            data = await client.get(key)
            if data:
                try:
                    return json.loads(data)
                except json.JSONDecodeError:
                    return data
            return None
        except Exception as e:
            logger.error(f"Redis get error for key '{key}': {e}")
            return None

    async def set(
        self, key: str, value: Any, expire_seconds: int = 3600
    ) -> bool:
        """Set value in cache. Serializes dictionary/list to JSON.

        Args:
            key: Cache key.
            value: Value to cache.
            expire_seconds: Time to live in seconds.

        Returns:
            bool: True if successful, False otherwise.
        """
        try:
            client = self.get_client()
            if isinstance(value, (dict, list)):
                serialized = json.dumps(value, default=str)
            else:
                serialized = str(value)
            
            await client.set(key, serialized, ex=expire_seconds)
            return True
        except Exception as e:
            logger.error(f"Redis set error for key '{key}': {e}")
            return False

    async def delete(self, key: str) -> bool:
        """Remove key from cache.

        Args:
            key: Cache key.

        Returns:
            bool: True if deleted, False otherwise.
        """
        try:
            client = self.get_client()
            await client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Redis delete error for key '{key}': {e}")
            return False


cache_service = RedisCacheService(settings.REDIS_URL)
