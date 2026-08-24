"""
Google OAuth authentication endpoints with CSRF protection.
Auto-detects registration vs login based on user existence.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from urllib.parse import urlencode
import httpx

from v1.db.session import get_db_session
from v1.services.user.user_manager import UserManager
from v1.dependencies.auth import get_user_manager
from v1.core.oauth import oauth_settings
from v1.constants.enums.oauth import OAuthProvider
from v1.core.rate_limit import limiter
from v1.core.config import settings
from v1.core.csrf import CSRFTokenManager, OAuthStateValidator
from v1.services.auth.oauth_flow_service import OAuthFlowService

router = APIRouter(prefix="/oauth/google", tags=["auth"])


@router.get("/login")
async def google_login(
    email: str,
    session: AsyncSession = Depends(get_db_session)
):
    """
    Initiate Google OAuth login flow.
    Auto-detects whether user is new (registration) or existing (login).
    
    Args:
        email: User's email address
        
    Returns:
        Redirect to Google OAuth consent screen
    """
    if not oauth_settings.AUTH_ENABLE_GOOGLE:
        raise HTTPException(status_code=403, detail="Google OAuth disabled")
    
    # Generate CSRF-protected state token
    state = CSRFTokenManager.create_state_token(email)
    
    # Build OAuth authorization URL
    params = {
        "client_id": oauth_settings.GOOGLE_CLIENT_ID,
        "redirect_uri": oauth_settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "login_hint": email,
        "access_type": "offline",  # Get refresh token
        "prompt": "consent",  # Force consent screen to ensure we get refresh token
    }
    
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    return RedirectResponse(auth_url)


@router.get("/callback")
@limiter.limit(settings.RATE_LIMIT_OAUTH)
async def google_callback(
    code: str,
    state: str,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    user_manager: UserManager = Depends(get_user_manager),
):
    """
    Handle Google OAuth callback.
    
    Validates CSRF token, exchanges code for user info,
    and creates/logs in user appropriately.
    
    Args:
        code: Authorization code from Google
        state: State parameter (contains CSRF token)
        request: FastAPI request
        session: Database session
        user_manager: User management service
        
    Returns:
        JWT authentication response
    """
    # Validate state and prevent CSRF attacks
    parsed_state = OAuthStateValidator.validate_callback_state(state, request)
    
    # Exchange authorization code for access token
    async with httpx.AsyncClient() as client:
        try:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": oauth_settings.GOOGLE_CLIENT_ID,
                    "client_secret": oauth_settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": oauth_settings.GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
                timeout=10.0
            )
            token_response.raise_for_status()
            token_data = token_response.json()
            access_token = token_data["access_token"]
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to exchange authorization code: {str(e)}"
            )
    
    # Get user info from Google
    async with httpx.AsyncClient() as client:
        try:
            user_info_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10.0
            )
            user_info_response.raise_for_status()
            user_info = user_info_response.json()
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to get user info from Google: {str(e)}"
            )
    
    # Extract user information
    google_email = user_info.get("email")
    google_id = user_info.get("id")
    name = user_info.get("name", "Google User")
    
    # Validate email matches
    if google_email != parsed_state["email"]:
        raise HTTPException(
            status_code=400,
            detail="Email mismatch between state and Google account"
        )
    
    # Handle user creation or login using OAuth flow service
    # The service auto-detects whether to register or login
    oauth_service = OAuthFlowService(session, user_manager)
    
    try:
        user, action = await oauth_service.process_oauth_user(
            email=google_email,
            name=name,
            provider=OAuthProvider.GOOGLE,
            provider_account_id=google_id,
            request=request
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error during OAuth flow: {str(e)}"
        )
    
    # Complete login and return JWT
    response = await oauth_service.complete_oauth_login(
        user=user,
        provider=OAuthProvider.GOOGLE,
        action=action,
        request=request
    )
    
    return response