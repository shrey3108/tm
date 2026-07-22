"""Zoho OAuth bridge routes using the embedded AugustLab auth package."""

from __future__ import annotations

from typing import AsyncGenerator
from urllib.parse import urlencode, quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.v1.core.config import settings
from app.v1.core.logging import get_logger
from app.v1.db.session import get_db
from app.v1.integrations.augustlab_auth import (
    bootstrap_auth_package,
    initialize_auth_package,
)
from app.v1.services.user_service import user_service

logger = get_logger(__name__)

router = APIRouter(prefix="/oauth/zoho", tags=["zoho-auth"])


def _frontend_redirect(path: str, **params: str) -> str:
    bootstrap_auth_package()
    from v1.core.config import settings as auth_settings

    base_url = auth_settings.FRONTEND_BASE_URL.rstrip("/")
    path_value = path if path.startswith("/") else f"/{path}"
    query = urlencode(params)
    return f"{base_url}{path_value}" + (f"?{query}" if query else "")


def _error_redirect(detail: str, status_code: int = status.HTTP_302_FOUND) -> RedirectResponse:
    return RedirectResponse(
        url=_frontend_redirect("/login", error=detail),
        status_code=status_code,
    )


async def get_auth_db() -> AsyncGenerator[AsyncSession, None]:
    bootstrap_auth_package()
    from v1.db.session import get_db_session

    async for session in get_db_session():
        yield session


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
    )


@router.get("/login")
async def zoho_login() -> RedirectResponse:
    bootstrap_auth_package()
    from v1.core.csrf import CSRFTokenManager
    from v1.core.oauth import oauth_settings

    if not oauth_settings.AUTH_ENABLE_ZOHO:
        raise HTTPException(status_code=403, detail="Zoho OAuth disabled")

    state = CSRFTokenManager.generate_token()
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
async def zoho_callback(
    code: str,
    state: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_db: AsyncSession = Depends(get_auth_db),
) -> RedirectResponse:
    if not state or len(state) < 32:
        return _error_redirect("Invalid Zoho callback state.")

    try:
        await initialize_auth_package()

        bootstrap_auth_package()
        from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase
        from v1.constants.enums.oauth import OAuthProvider
        from v1.core.oauth import oauth_settings
        from v1.db.models.user import User as AuthUser
        from v1.services.auth.oauth_account_service import OAuthAccountService
        from v1.services.auth.oauth_flow_service import OAuthFlowService
        from v1.services.user.user_manager import UserManager

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
                timeout=10.0,
            )
            token_response.raise_for_status()
            token_data = token_response.json()
            logger.info("Zoho token response keys: %s", list(token_data.keys()))
            access_token = token_data["access_token"]
            zoho_refresh_token = token_data.get("refresh_token")

        async with httpx.AsyncClient() as client:
            user_info_response = await client.get(
                f"{oauth_settings.ZOHO_DOMAIN}/oauth/user/info",
                headers={"Authorization": f"Zoho-oauthtoken {access_token}"},
                timeout=10.0,
            )
            user_info_response.raise_for_status()
            user_info = user_info_response.json()
            logger.info("Zoho user info response keys: %s", list(user_info.keys()))

        zoho_email = user_info.get("Email")
        zoho_id = user_info.get("ZUID")
        name = user_info.get("Display_Name", "Zoho User")

        if not zoho_email or not zoho_id:
            return _error_redirect("Could not retrieve a valid Zoho identity.")

        user_db = SQLAlchemyUserDatabase(auth_db, AuthUser)
        user_manager = UserManager(user_db)
        oauth_service = OAuthFlowService(auth_db, user_manager)

        auth_user, action = await oauth_service.process_oauth_user(
            email=zoho_email,
            name=name,
            provider=OAuthProvider.ZOHO,
            provider_account_id=str(zoho_id),
            request=request,
        )

        if zoho_refresh_token:
            oauth_account_service = OAuthAccountService(auth_db)
            await oauth_account_service.create_or_update_oauth_account(
                user_id=auth_user.id,
                provider_name=OAuthProvider.ZOHO.value,
                refresh_token=zoho_refresh_token,
            )

        await oauth_service.complete_oauth_login(
            user=auth_user,
            provider=OAuthProvider.ZOHO,
            action=action,
            request=request,
        )

        app_user = await user_service.resolve_user_for_oauth(
            db=db,
            auth_user_id=auth_user.id,
            email=zoho_email,
            full_name=name,
        )

        logger.info("Resolved app user: id=%s role=%s permissions_count=%s", app_user.id, app_user.role_name, len(app_user.permissions or []))
        login_response = await user_service.issue_login_response_for_user(
            db=db,
            user_id=app_user.id,
        )

        redirect_response = RedirectResponse(
            url=_frontend_redirect(
                "/auth/callback",
                email=zoho_email,
                name=name,
                zoho_user_id=quote(str(zoho_id)),
            ),
            status_code=status.HTTP_302_FOUND,
        )
        _set_auth_cookies(
            response=redirect_response,
            access_token=login_response.access_token,
            refresh_token=login_response.refresh_token,
        )
        return redirect_response
    except HTTPException as exc:
        logger.warning("Zoho auth callback failed: %s", exc.detail)
        return _error_redirect(str(exc.detail))
    except httpx.HTTPError as exc:
        logger.exception("Zoho OAuth exchange failed")
        return _error_redirect("Zoho authentication failed. Please try again.")
    except Exception:
        logger.exception("Unexpected Zoho auth failure")
        return _error_redirect("Unable to complete Zoho login.")