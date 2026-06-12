import pytest
from app.v1.core.cache import cache

@pytest.fixture(autouse=True)
async def clear_redis_cache():
    """Clear Redis cache before and after each test to prevent test isolation/pollution issues."""
    try:
        await cache.clear()
    except Exception:
        pass
    yield
    try:
        await cache.clear()
    except Exception:
        pass
