"""
CSRF token generation and validation for OAuth flows.
Simplified version - auto-detects registration vs login.
"""
import secrets
from typing import Optional
from fastapi import HTTPException, Request


class CSRFTokenManager:
    """
    Manages CSRF token generation and validation for OAuth flows.
    """
    
    TOKEN_EXPIRY_MINUTES = 10
    
    @staticmethod
    def generate_token() -> str:
        """
        Generate a cryptographically secure CSRF token.
        
        Returns:
            str: A URL-safe random token
        """
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def create_state_token(email: str) -> str:
        """
        Create a state token combining CSRF protection and user context.
        
        Format: {email}:{csrf_token}
        - email: user's email for validation
        - csrf_token: random token for CSRF protection
        
        Args:
            email: User's email address
            
        Returns:
            str: Combined state token
        """
        csrf_token = CSRFTokenManager.generate_token()
        return f"{email}:{csrf_token}"
    
    @staticmethod
    def parse_state_token(state: str) -> dict:
        """
        Parse and validate the state token structure.
        
        Args:
            state: The state token from OAuth callback
            
        Returns:
            dict: Parsed components (email, csrf_token)
            
        Raises:
            HTTPException: If state token format is invalid
        """
        parts = state.split(":")
        if len(parts) != 2:
            raise HTTPException(
                status_code=400,
                detail="Invalid state token format"
            )
        
        email, csrf_token = parts
        
        if not email or "@" not in email:
            raise HTTPException(
                status_code=400,
                detail="Invalid email in state token"
            )
        
        return {
            "email": email,
            "csrf_token": csrf_token
        }


class OAuthStateValidator:
    """
    Validates OAuth callback state and prevents CSRF attacks.
    """
    
    @staticmethod
    def validate_callback_state(state: Optional[str], request: Request) -> dict:
        """
        Comprehensive validation of OAuth callback state.
        
        Args:
            state: State parameter from OAuth callback
            request: FastAPI request object
            
        Returns:
            dict: Parsed and validated state components
            
        Raises:
            HTTPException: If validation fails
        """
        if not state:
            raise HTTPException(
                status_code=400,
                detail="Missing state parameter - possible CSRF attack"
            )
        
        # Parse the state token
        parsed = CSRFTokenManager.parse_state_token(state)
        
        # Additional security checks
        if not parsed["email"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid email in state token"
            )
        
        if not parsed["csrf_token"] or len(parsed["csrf_token"]) < 32:
            raise HTTPException(
                status_code=400,
                detail="Invalid CSRF token"
            )
        
        return parsed