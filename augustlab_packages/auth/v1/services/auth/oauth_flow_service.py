"""
OAuth flow handler service for Google and Zoho authentication.
Handles both new user registration and existing user login.
Auto-detects whether user is new or existing.
"""
from typing import Optional
from fastapi import Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import secrets

from v1.db.models.user import User
from v1.db.models.oauth_account import OAuthAccount
from v1.schemas.user import CustomUserCreate
from v1.services.user.user_manager import UserManager
from v1.services.auth.auth_session_service import AuthSessionService
from v1.constants.enums.auth import AuthAction
from v1.constants.enums.oauth import OAuthProvider
from v1.core.auth import auth_backend, get_jwt_strategy


class OAuthFlowService:
    """
    Handles OAuth authentication flow for new and existing users.
    Automatically detects whether to register or login.
    """
    
    def __init__(self, session: AsyncSession, user_manager: UserManager):
        self.session = session
        self.user_manager = user_manager
    
    async def process_oauth_user(
        self,
        email: str,
        name: str,
        provider: OAuthProvider,
        provider_account_id: str,
        request: Request
    ) -> tuple[User, AuthAction]:
        """
        Process OAuth user - auto-detect if new or existing.
        
        Args:
            email: User's email from OAuth provider
            name: User's display name from OAuth provider
            provider: OAuth provider (Google, Zoho, etc.)
            provider_account_id: Unique ID from OAuth provider
            request: FastAPI request object
            
        Returns:
            tuple: (User object, AuthAction enum)
        """
        # Check if user exists by email
        existing_user = await self._find_user_by_email(email)
        
        if existing_user:
            # User exists - this is a login
            await self._ensure_oauth_account_linked(
                existing_user, provider, provider_account_id
            )
            return existing_user, AuthAction.LOGIN
        else:
            # User doesn't exist - create new account (registration)
            new_user = await self._create_oauth_user(
                email=email,
                name=name,
                request=request
            )
            
            # Link OAuth account
            await self._create_oauth_account(
                user=new_user,
                provider=provider,
                provider_account_id=provider_account_id
            )
            
            return new_user, AuthAction.REGISTER
    
    async def _find_user_by_email(self, email: str) -> Optional[User]:
        """Find user by email address."""
        result = await self.session.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    async def _create_oauth_user(
        self,
        email: str,
        name: str,
        request: Request
    ) -> User:
        """
        Create a new user from OAuth data.
        
        Args:
            email: User's email
            name: User's display name
            request: FastAPI request
            
        Returns:
            User: Newly created user
        """
        user = await self.user_manager.create(
            CustomUserCreate(
                email=email,
                password=secrets.token_urlsafe(32),  # Random password for OAuth users
                users_name=name,
                is_verified=True,  # OAuth email is pre-verified
            ),
            safe=True,
            request=request,
        )
        return user
    
    async def _ensure_oauth_account_linked(
        self,
        user: User,
        provider: OAuthProvider,
        provider_account_id: str
    ) -> None:
        """
        Ensure OAuth account is linked to user.
        If not linked, create the link.
        """
        # Check if OAuth account already exists
        # Try different possible column names for the OAuth provider
        result = await self.session.execute(
            select(OAuthAccount).where(
                OAuthAccount.user_id == user.id,
            )
        )
        oauth_account = result.scalar_one_or_none()
        
        if not oauth_account:
            # Create new OAuth account link
            await self._create_oauth_account(user, provider, provider_account_id)
    
    async def _create_oauth_account(
        self,
        user: User,
        provider: OAuthProvider,
        provider_account_id: str
    ) -> OAuthAccount:
        """
        Create OAuth account link.
        
        Args:
            user: User to link to
            provider: OAuth provider
            provider_account_id: Provider's unique ID for this account
            
        Returns:
            OAuthAccount: Created OAuth account record
        """
        oauth_account = OAuthAccount(
            user_id=user.id,
            provider_name=provider.value,
            access_token="",  # Not stored for security
        )
        self.session.add(oauth_account)
        await self.session.commit()
        await self.session.refresh(oauth_account)
        return oauth_account
    
    async def complete_oauth_login(
        self,
        user: User,
        provider: OAuthProvider,
        action: AuthAction,
        request: Request
    ):
        """
        Complete OAuth login by creating session and returning JWT.
        
        Args:
            user: Authenticated user
            provider: OAuth provider used
            action: Whether this was login or registration
            request: FastAPI request
            
        Returns:
            FastAPI response with JWT token
        """
        # Create auth session and log
        auth_service = AuthSessionService(self.session)
        await auth_service.create_login_session(
            request=request,
            user=user,
            provider=provider,
            action=action
        )
        
        # Generate JWT token using FastAPI-Users backend
        response = await auth_backend.login(
            strategy=get_jwt_strategy(),
            user=user,
        )
        
        return response