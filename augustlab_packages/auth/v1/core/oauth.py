"""
OAuth configuration for Google and Zoho providers (Global Credentials).
"""
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class OAuthSettings(BaseSettings):
    """
    OAuth provider credentials (Global - stored in .env file).
    
    These credentials are shared across all organizations.
    For per-organization credentials, see advanced implementation.
    """
    AUTH_ENABLE_CUSTOM_LOGIN: bool = Field(default=True)
    AUTH_ENABLE_GOOGLE: bool = Field(default=False)
    AUTH_ENABLE_ZOHO: bool = Field(default=False)
    
    # Google OAuth
    GOOGLE_CLIENT_ID: str = Field(
        default="",
        description="Google OAuth Client ID"
    )
    GOOGLE_CLIENT_SECRET: str = Field(
        default="",
        description="Google OAuth Client Secret"
    )
    GOOGLE_REDIRECT_URI: str = Field(
        default="http://localhost:8007/auth/google/callback",
        description="Google OAuth Redirect URI"
    )
    
    # Zoho OAuth
    ZOHO_CLIENT_ID: str = Field(
        default="",
        description="Zoho OAuth Client ID"
    )
    ZOHO_CLIENT_SECRET: str = Field(
        default="",
        description="Zoho OAuth Client Secret"
    )
    ZOHO_REDIRECT_URI: str = Field(
        default="http://localhost:8007/auth/zoho/callback",
        description="Zoho OAuth Redirect URI"
    )
    ZOHO_DOMAIN: str = Field(
        default="https://accounts.zoho.com",
        description="Zoho OAuth Domain (based on region: .com, .eu, .in, .com.au)"
    )
    
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[4] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


# Singleton instance
oauth_settings = OAuthSettings()