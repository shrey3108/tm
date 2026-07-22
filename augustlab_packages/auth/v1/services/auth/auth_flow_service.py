"""
Auth flow service.
High-level orchestration for authentication flows.
"""
from fastapi import Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from v1.services.auth.auth_session_service import AuthSessionService
from v1.services.auth.oauth_account_service import OAuthAccountService
from v1.services.auth.token_service import TokenService
from v1.constants.enums.auth import AuthAction


class AuthFlowService:
    """
    Coordinates authentication flows.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.sessions = AuthSessionService(session)
        self.oauth = OAuthAccountService(session)
        self.tokens = TokenService()

    async def oauth_login(
        self,
        request: Request,
        provider: str,
        email: str,
        access_token: str | None = None,
        refresh_token: str | None = None,
    ) -> str:
        user = await self.oauth.get_user_by_email(email)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        enabled = await self.oauth.is_provider_enabled(
            user.organization_id,
            provider,
        )
        if not enabled:
            raise HTTPException(
                status_code=403,
                detail=f"{provider} login not enabled",
            )

        await self.oauth.create_or_update_oauth_account(
            user_id=user.id,
            provider_name=provider,
            access_token=access_token,
            refresh_token=refresh_token,
        )

        await self.sessions.create_login_session(
            request=request,
            user=user,
            provider=provider,
            action=AuthAction.LOGIN,
        )

        return await self.tokens.create_access_token(user)

    async def logout(self, user_id):
        await self.sessions.invalidate_all_user_sessions(user_id)
