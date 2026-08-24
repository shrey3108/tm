"""
Exposes create_auth_app() so the package can be used as a library.
"""
from fastapi import FastAPI, APIRouter
from contextlib import asynccontextmanager

from v1.api.routes.auth import router as auth_router
from v1.api.routes.users import router as users_router
from v1.api.routes.validator import router as validator_router
from v1.api.routes.auth_logs import router as auth_logs_router
from v1.api.routes.oauth import routers as oauth_routers
from v1.db.base import Base
from v1.db.session import engine
from v1.db.models.user import User  # noqa: F401
from v1.db.models.organization import Organization  # noqa: F401
from v1.db.models.subscription_package import SubscriptionPackage  # noqa: F401
from v1.db.models.organization_settings import OrganizationSettings  # noqa: F401
from v1.db.models.auth_log import AuthLog  # noqa: F401
from v1.db.models.session import Session  # noqa: F401
from v1.db.models.oauth_account import OAuthAccount  # noqa: F401
from v1.core.rate_limit import limiter


def create_auth_app() -> FastAPI:
    """
    Factory function — returns a fully configured auth FastAPI app.
    Mount this onto your main app at any prefix.
    """

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        yield

    auth_app = FastAPI(
        title="AugustLab Auth",
        version="1.0.0",
        description="Authentication and authorization service",
        lifespan=lifespan,
        swagger_ui_parameters={"defaultModelsExpandDepth": -1},
    )

    auth_app.state.limiter = limiter

    api_v1_router = APIRouter(prefix="/v1")
    api_v1_router.include_router(auth_router,      prefix="/auth",      tags=["auth"])
    api_v1_router.include_router(users_router,     prefix="/users",     tags=["users"])
    api_v1_router.include_router(auth_logs_router, prefix="/auth/logs", tags=["auth"])
    api_v1_router.include_router(validator_router, prefix="/auth",      tags=["auth"])
    for r in oauth_routers:
        api_v1_router.include_router(r)

    auth_app.include_router(api_v1_router)

    @auth_app.get("/health")
    async def health_check():
        return {"status": "healthy"}

    return auth_app
