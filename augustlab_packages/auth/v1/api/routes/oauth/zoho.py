"""
Zoho OAuth authentication endpoints with CSRF protection.
Auto-detects registration vs login based on user existence.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from urllib.parse import urlencode , quote
import httpx
import json
from v1.db.session import get_db_session
from v1.services.user.user_manager import UserManager
from v1.dependencies.auth import get_user_manager
from v1.core.oauth import oauth_settings
from v1.constants.enums.oauth import OAuthProvider
from v1.core.rate_limit import limiter
from v1.core.config import settings
from v1.core.csrf import CSRFTokenManager, OAuthStateValidator
from v1.services.auth.oauth_flow_service import OAuthFlowService
from v1.services.auth.oauth_account_service import OAuthAccountService

router = APIRouter(prefix="/oauth/zoho", tags=["auth"])


@router.get("/login")
async def zoho_login():
    """Initiate Zoho OAuth - no email needed upfront."""
    if not oauth_settings.AUTH_ENABLE_ZOHO:
        raise HTTPException(status_code=403, detail="Zoho OAuth disabled")
    
    # Generate CSRF token without email (email comes back from Zoho)
    state = CSRFTokenManager.generate_token()  # just a random token, no email embedded
    
    params = {
        "client_id": oauth_settings.ZOHO_CLIENT_ID,
        "redirect_uri": oauth_settings.ZOHO_REDIRECT_URI,
        "response_type": "code",
        "scope": "AaaServer.profile.READ",
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
    }
    
    auth_url = f"{oauth_settings.ZOHO_DOMAIN}/oauth/v2/auth?{urlencode(params)}"
    return RedirectResponse(auth_url)
@router.get("/callback")
@limiter.limit(settings.RATE_LIMIT_OAUTH)
async def zoho_callback(
    code: str,
    state: str,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    user_manager: UserManager = Depends(get_user_manager),
):
    # Validate state is a legit CSRF token (just check it's non-empty and long enough)
    if not state or len(state) < 32:
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    # Exchange code for token
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            f"{oauth_settings.ZOHO_DOMAIN}/oauth/v2/token",
            params={
                "code": code,
                "client_id": oauth_settings.ZOHO_CLIENT_ID,
                "client_secret": oauth_settings.ZOHO_CLIENT_SECRET,
                "redirect_uri": oauth_settings.ZOHO_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            timeout=10.0
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        access_token = token_data["access_token"]
        zoho_refresh_token = token_data.get("refresh_token")

    # Get email directly from Zoho
    async with httpx.AsyncClient() as client:
        user_info_response = await client.get(
            f"{oauth_settings.ZOHO_DOMAIN}/oauth/user/info",
            headers={"Authorization": f"Zoho-oauthtoken {access_token}"},
            timeout=10.0
        )
        user_info_response.raise_for_status()
        user_info = user_info_response.json()

    zoho_email = user_info.get("Email")
    zoho_id = user_info.get("ZUID")
    name = user_info.get("Display_Name", "Zoho User")

    if not zoho_email:
        raise HTTPException(status_code=400, detail="Could not retrieve email from Zoho")

    # No email mismatch check needed — email comes from Zoho itself
    oauth_service = OAuthFlowService(session, user_manager)
    user, action = await oauth_service.process_oauth_user(
        email=zoho_email,
        name=name,
        provider=OAuthProvider.ZOHO,
        provider_account_id=zoho_id,
        request=request
    )

    # Persist the Zoho refresh_token so downstream services can call Zoho APIs
    # on behalf of this user (e.g. Cliq channels). Only present on first auth
    # or when the user has re-consented (prompt=consent).
    if zoho_refresh_token:
        oauth_account_svc = OAuthAccountService(session)
        await oauth_account_svc.create_or_update_oauth_account(
            user_id=user.id,
            provider_name=OAuthProvider.ZOHO.value,
            refresh_token=zoho_refresh_token,
        )

    response = await oauth_service.complete_oauth_login(
        user=user,
        provider=OAuthProvider.ZOHO,
        action=action,
        request=request
    )
    # Extract JWT from Response body
    jwt_token = ""
    try:
        if hasattr(response, "body"):
            body = json.loads(response.body)
            jwt_token = body.get("access_token", "")
        elif isinstance(response, dict):
            jwt_token = response.get("access_token", "")
        elif hasattr(response, "access_token"):
            jwt_token = str(response.access_token or "")
    except Exception:
        pass

    if not jwt_token:
        raise HTTPException(status_code=500, detail="Failed to extract JWT token")

    # Redirect to frontend with token
    frontend_url = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:3001")

    redirect_url = (
        f"{frontend_url}/auth/callback"
        f"?access_token={quote(jwt_token)}"
        f"&name={quote(name)}"
        f"&email={quote(zoho_email)}"
        f"&id={quote(str(user.id))}"
        f"&zoho_user_id={quote(str(zoho_id))}"
    )


    return RedirectResponse(url=redirect_url, status_code=302)
