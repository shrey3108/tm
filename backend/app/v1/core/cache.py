"""
Redis cache module.

This module provides a robust, reusable async Redis cache client for
application-wide caching with proper serialization and connection management.
"""

import json
import logging
from typing import Any

import redis.asyncio as aioredis

from app.v1.core.config import settings

_log = logging.getLogger(__name__)


class RedisCache:
    """Async Redis cache with JSON serialization."""

    def __init__(self, url: str) -> None:
        self._url = url
        self._client: aioredis.Redis | None = None

    def _get_client(self) -> aioredis.Redis | None:
        """Lazily initialize the Redis client; returns None if Redis is unavailable."""
        if self._client is not None:
            return self._client
        try:
            self._client = aioredis.from_url(
                self._url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=1,
            )
        except Exception as exc:  # noqa: BLE001
            _log.warning("Redis unavailable, caching disabled: %s", exc)
        return self._client

    async def get(self, key: str) -> Any | None:
        """Retrieve and deserialize a value from the cache."""
        client = self._get_client()
        if client is None:
            return None
        try:
            raw = await client.get(key)
            return json.loads(raw) if raw else None
        except Exception as exc:  # noqa: BLE001
            _log.debug("Redis GET failed key=%s: %s", key, exc)
            return None

    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        """Serialize and store a value in the cache with an optional TTL."""
        client = self._get_client()
        if client is None:
            return
        try:
            raw = json.dumps(value, default=str)
            await client.set(key, raw, ex=ttl or settings.CACHE_TTL_SECONDS)
        except Exception as exc:  # noqa: BLE001
            _log.debug("Redis SET failed key=%s: %s", key, exc)

    async def set_nx(self, key: str, value: Any, ttl: int) -> bool:
        """Serialize and store a value only if it doesn't exist (NX). Returns True if set."""
        client = self._get_client()
        if client is None:
            return True  # Fallback to True if Redis is down
        try:
            raw = json.dumps(value, default=str)
            result = await client.set(key, raw, ex=ttl, nx=True)
            return bool(result)
        except Exception as exc:  # noqa: BLE001
            _log.debug("Redis SETNX failed key=%s: %s", key, exc)
            return True

    async def delete(self, key: str) -> None:
        """Remove a value from the cache."""
        client = self._get_client()
        if client is None:
            return
        try:
            await client.delete(key)
        except Exception as exc:  # noqa: BLE001
            _log.debug("Redis DELETE failed key=%s: %s", key, exc)

    async def clear(self, pattern: str = "*") -> bool:
        """
        Clear keys matching a pattern.
        Defaults to "*" which clears all keys in the current DB.
        """
        client = self._get_client()
        if client is None:
            return False
        try:
            if pattern == "*":
                # If we really want to clear EVERYTHING, flushdb is faster
                # But we'll default to scan/delete if we want to be safe in the future
                await client.flushdb()
            else:
                # Selective delete using SCAN
                count = 0
                async for key in client.scan_iter(match=pattern):
                    await client.delete(key)
                    count += 1
                _log.info("Cleared %d keys matching pattern: %s", count, pattern)
            return True
        except Exception as exc:  # noqa: BLE001
            _log.error("Redis clear failed: %s", exc)
            return False

    async def keys(self, pattern: str = "*") -> list[str]:
        """
        List keys matching a pattern.
        Returns a list of string keys.
        """
        client = self._get_client()
        if client is None:
            return []
        try:
            return [key async for key in client.scan_iter(match=pattern)]
        except Exception as exc:  # noqa: BLE001
            _log.error("Redis KEYS failed pattern=%s: %s", pattern, exc)
            return []

    async def close(self) -> None:
        """Gracefully close the Redis connection."""
        if self._client is not None:
            try:
                await self._client.aclose()
            except Exception:  # noqa: BLE001
                pass
            self._client = None


# Global cache instance
cache = RedisCache(settings.REDIS_URL)
