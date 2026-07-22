"""
OAuth account service.
Handles OAuth provider rules and OAuth account persistence.
"""
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from v1.db.models.oauth_account import OAuthAccount
from v1.db.models.organization_settings import OrganizationSettings
from v1.db.models.user import User
from v1.services.user.user_service import UserService


class OAuthAccountService:
    """
    Manages OAuth provider configuration and OAuth accounts.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_service = UserService(session)

    async def get_organization_settings(
        self,
        organization_id: UUID,
    ) -> OrganizationSettings | None:
        stmt = select(OrganizationSettings).where(
            OrganizationSettings.organization_id == organization_id
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def is_provider_enabled(
        self,
        organization_id: UUID,
        provider: str,
    ) -> bool:
        settings = await self.get_organization_settings(organization_id)

        if not settings:
            return provider == "custom"

        provider_map = {
            "google": settings.enable_google,
            "zoho": settings.enable_zoho,
            "custom": settings.custom_login,
        }

        return provider_map.get(provider, False)

    async def get_user_by_email(self, email: str) -> User | None:
        return await self.user_service.get_user_by_email(email)

    async def get_oauth_account(
        self,
        user_id: UUID,
        provider_name: str | None = None,
    ) -> OAuthAccount | None:
        stmt = select(OAuthAccount).where(
            OAuthAccount.user_id == user_id,
        )
        if provider_name is not None:
            stmt = stmt.where(OAuthAccount.provider_name == provider_name)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_or_update_oauth_account(
        self,
        user_id: UUID,
        provider_name: str,
        access_token: str | None = None,
        refresh_token: str | None = None,
        current_location: str | None = None,
    ) -> OAuthAccount:
        oauth = await self.get_oauth_account(user_id, provider_name)

        if oauth:
            if access_token:
                oauth.access_token = access_token
            if refresh_token:
                oauth.refresh_token = refresh_token
            if current_location:
                oauth.current_location = current_location
        else:
            oauth = OAuthAccount(
                user_id=user_id,
                provider_name=provider_name,
                access_token=access_token,
                refresh_token=refresh_token,
                current_location=current_location,
            )
            self.session.add(oauth)

        await self.session.commit()
        await self.session.refresh(oauth)
        return oauth
