import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from github_code_evaluator.app.v1.core.config import settings

logger = logging.getLogger(__name__)

# Security scheme
security_scheme = HTTPBearer(auto_error=False)

# Transient developer keypair fallback
DEV_PRIVATE_KEY = None
DEV_PUBLIC_KEY = None


def generate_dev_keypair() -> None:
    """Generate a transient RSA keypair for local developer testing if none is configured."""
    global DEV_PRIVATE_KEY, DEV_PUBLIC_KEY
    try:
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import rsa

        # Generate RSA private key
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )
        # Serialize private key in PEM format
        DEV_PRIVATE_KEY = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
        # Serialize public key in PEM format
        public_key = private_key.public_key()
        DEV_PUBLIC_KEY = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        logger.warning(
            "--- WARNING: NO JWT_PUBLIC_KEY CONFIGURED ---"
        )
        logger.warning(
            "Generated transient RSA keypair for local development."
        )
        logger.warning(
            "You can generate a test Bearer token at the API endpoint:"
        )
        logger.warning(
            "GET /api/v1/auth/token"
        )
        logger.warning(
            "---------------------------------------------"
        )
    except Exception as e:
        logger.error(f"Failed to generate dev RSA keypair: {e}")


def get_public_key() -> bytes:
    """Get the configured public key or fallback to the transient developer public key.

    Returns:
        bytes: Public key PEM bytes.
    """
    if settings.JWT_PUBLIC_KEY:
        # If public key is provided as a string in config, convert to bytes
        return settings.JWT_PUBLIC_KEY.encode("utf-8")
    
    if DEV_PUBLIC_KEY is None:
        generate_dev_keypair()
        
    return DEV_PUBLIC_KEY  # type: ignore


def generate_test_token(
    payload: Dict[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """Helper to generate a signed JWT using the private key (useful for tests/dev).

    Args:
        payload: Custom claims to include in the token.
        expires_delta: Token expiration duration.

    Returns:
        str: Encoded JWT string.
    """
    to_encode = payload.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=1)
    
    to_encode.update({"exp": int(expire.timestamp())})
    
    # We must sign with the private key
    private_key = None
    if settings.JWT_PRIVATE_KEY:
        private_key = settings.JWT_PRIVATE_KEY.get_secret_value().encode("utf-8")
    else:
        if DEV_PRIVATE_KEY is None:
            generate_dev_keypair()
        private_key = DEV_PRIVATE_KEY
        
    return jwt.encode(to_encode, private_key, algorithm="RS256")  # type: ignore


class UserSession(BaseModel):
    """Pydantic model representing JWT session data."""

    sub: str
    role: str = "user"
    permissions: list[str] = []


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
) -> Dict[str, Any]:
    """Dependency to retrieve and validate the JWT from the Authorization header.

    Args:
        credentials: The HTTPBearer credentials.

    Returns:
        dict: The decoded token payload.
    """
    # Allow authentication bypass in development if explicitly configured
    if settings.ENVIRONMENT == "development" and not credentials:
        # Fallback payload for ease of developer manual checks
        return {"sub": "developer-bypass", "role": "admin"}

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    if credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication scheme. Only Bearer is supported.",
        )

    token = credentials.credentials
    try:
        public_key = get_public_key()
        payload = jwt.decode(token, public_key, algorithms=["RS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )
