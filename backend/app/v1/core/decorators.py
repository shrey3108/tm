import functools
import json
from typing import Any, Callable

from fastapi import Request, Response
from pydantic import BaseModel

from app.v1.core.cache import cache

def cache_response(ttl_seconds: int = 300):
    """
    Decorator to cache the JSON response of a FastAPI endpoint using the global Redis cache.
    The cache key is based on the request method, path, and query parameters.
    """
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, request: Request, response: Response, **kwargs):
            # Generate a unique cache key based on the request URL
            key = f"cache:{request.method}:{request.url.path}?{request.url.query}"
            
            # Try to get the cached response
            cached_data = await cache.get(key)
            if cached_data is not None:
                response.headers["X-Cache"] = "HIT"
                return cached_data
                
            # If not in cache, execute the actual endpoint
            result = await func(*args, request=request, response=response, **kwargs)
            
            # Serialize the result to store in cache
            if isinstance(result, BaseModel):
                data_to_cache = result.model_dump(mode="json")
            elif isinstance(result, list):
                data_to_cache = [
                    item.model_dump(mode="json") if isinstance(item, BaseModel) else item 
                    for item in result
                ]
            else:
                data_to_cache = result
                
            # Store in cache
            await cache.set(key, data_to_cache, ttl=ttl_seconds)
            
            response.headers["X-Cache"] = "MISS"
            return result
            
        return wrapper
    return decorator
