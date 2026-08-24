"""
Request utility functions.
"""
from fastapi import Request
from typing import Optional


def get_client_ip(request: Optional[Request]) -> Optional[str]:
    """
    Extract real client IP address considering proxies.
    """
    if request is None:
        return None
    
    # X-Forwarded-For: client, proxy1, proxy2
    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    
    # Cloudflare
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip
    
    # Fallback
    if request.client:
        return request.client.host
    
    return None