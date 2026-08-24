from fastapi import APIRouter
from v1.core.oauth import OAuthSettings

router = APIRouter(tags=["auth"])

@router.get("/check-providers/{email}")
async def check_enabled_providers(email: str):
    """
    ENV-based provider availability
    """
    return {
        "custom_login": OAuthSettings.AUTH_ENABLE_CUSTOM_LOGIN,
        "google": OAuthSettings.AUTH_ENABLE_GOOGLE,
        "zoho": OAuthSettings.AUTH_ENABLE_ZOHO,
        "message": "Provider availability loaded from environment"
    }
