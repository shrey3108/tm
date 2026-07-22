"""
Authentication endpoints: registration, login, password reset, etc.
"""
import os
from v1.constants.enums.oauth import OAuthProvider
from fastapi import APIRouter, Depends, HTTPException, Request , status
from fastapi.security import OAuth2PasswordBearer

from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()




from v1.core.auth import (
    fastapi_users,
    auth_backend,
    get_jwt_strategy,
    current_active_user,
)
from v1.db.session import get_db_session
from v1.schemas.user import CustomUserRead, CustomUserCreate
from v1.schemas.login import LoginRequest
from v1.dependencies.auth import get_user_manager
from v1.services.user.user_manager import UserManager
from v1.services.auth.auth_session_service import AuthSessionService
from v1.services.auth.auth_flow_service import AuthFlowService
from v1.constants.enums.auth import AuthAction
from v1.core.oauth import oauth_settings
from v1.db.models.user import User
from v1.core.rate_limit import limiter
from v1.core.config import settings
from fastapi_users.authentication import JWTStrategy

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="v1/auth/login")

# ============================================================================
# Registration
# ============================================================================
router.include_router(
    fastapi_users.get_register_router(CustomUserRead, CustomUserCreate),
    tags=["auth"],
)

# ============================================================================
# Login
# ============================================================================

async def get_current_user_from_jwt(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    user_manager: UserManager = Depends(get_user_manager),
) -> User:
    token = credentials.credentials

    strategy = get_jwt_strategy()
    user = await strategy.read_token(token, user_manager)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Inactive user")

    return user


@router.post("/login", tags=["auth"])
@limiter.limit(settings.RATE_LIMIT_LOGIN)
async def login(
    request: Request,
    data: LoginRequest,
    session: AsyncSession = Depends(get_db_session),
    user_manager: UserManager = Depends(get_user_manager),
):
    if not oauth_settings.AUTH_ENABLE_CUSTOM_LOGIN:
        raise HTTPException(status_code=403, detail="Custom login disabled")

    credentials = OAuth2PasswordRequestForm(
        username=data.email,
        password=data.password,
    )

    user = await user_manager.authenticate(credentials)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or password")

    # ✅ IMPORTANT: Login via FastAPI-Users backend
    response = await auth_backend.login(
        strategy=get_jwt_strategy(),
        user=user,
    )

    # ✅ Create auth log + session (NO token creation here)
    auth_service = AuthSessionService(session)
    await auth_service.create_login_session(
        request=request,
        user=user,
        provider=OAuthProvider.EMAIL,
        action=AuthAction.LOGIN,
    )

    return response

@router.get("/session/validate", tags=["auth"])
async def session_validate(
    user: User = Depends(get_current_user_from_jwt),
    db: AsyncSession = Depends(get_db_session),
):
    auth_service = AuthSessionService(db)

    is_valid = await auth_service.is_session_valid(user)

    if not is_valid:
        raise HTTPException(status_code=401, detail="Session expired or logged out")

    return {
        "authenticated": True,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "is_verified": user.is_verified,
        },
    }

# ============================================================================
# Logout
# ============================================================================
@router.post("/logout", tags=["auth"])
async def logout(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Logout user and invalidate all active sessions.
    """
    flow = AuthFlowService(session)
    await flow.logout(user.id)

    return {"message": "Logged out successfully"}

# ============================================================================
# Reset Password
# ============================================================================
router.include_router(
    fastapi_users.get_reset_password_router(),
    tags=["auth"],
)

# ============================================================================
# Verify Email
# ============================================================================
router.include_router(
    fastapi_users.get_verify_router(CustomUserRead),
    tags=["auth"],
)
