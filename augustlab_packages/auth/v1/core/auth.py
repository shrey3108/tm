"""
FastAPI-Users core authentication wiring.
Configures authentication backends and user management.
"""
import uuid
from fastapi_users import FastAPIUsers
from fastapi_users.authentication import (
    AuthenticationBackend,
    JWTStrategy,
    BearerTransport,
)
from v1.dependencies.auth import get_user_manager
from v1.db.models.user import User
from v1.core.config import settings

# ============================================================================
# Transport Configuration
# ============================================================================

bearer_transport = BearerTransport(
    tokenUrl="/v1/auth/login"  # ✅ FIXED
)

# ============================================================================
# JWT Strategy
# ============================================================================

def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(
        secret=settings.JWT_SECRET,
        lifetime_seconds=settings.JWT_EXPIRE_SECONDS,
        token_audience="auth-api",
        algorithm="HS256",
    )

# ============================================================================
# Authentication Backend
# ============================================================================

auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

# ============================================================================
# FastAPI-Users Instance
# ============================================================================

fastapi_users = FastAPIUsers[User, uuid.UUID](
    get_user_manager,
    [auth_backend],
)

# ============================================================================
# Dependency Helpers
# ============================================================================

current_active_user = fastapi_users.current_user(active=True)
current_superuser = fastapi_users.current_user(active=True, superuser=True)
current_verified_user = fastapi_users.current_user(active=True, verified=True)
current_user_optional = fastapi_users.current_user(optional=True)
