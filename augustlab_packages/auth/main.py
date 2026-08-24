"""
Main FastAPI application entry point.
"""
from fastapi import FastAPI , APIRouter
from contextlib import asynccontextmanager
from v1.api.routes.auth import router as auth_router
from v1.api.routes.users import router as users_router
from v1.api.routes.validator import router as validator_router
from v1.api.routes.auth_logs import router as auth_logs_router
from v1.api.routes.oauth import routers as oauth_routers
from v1.db.base import Base
from v1.db.session import engine

# IMPORTANT: Import all models so Base knows them
from v1.db.models.user import User  # noqa: F401
from v1.db.models.organization import Organization  # noqa: F401
from v1.db.models.subscription_package import SubscriptionPackage # noqa: F401
from v1.db.models.organization_settings import OrganizationSettings # noqa: F401
from v1.db.models.auth_log import AuthLog  # noqa: F401
from v1.db.models.session import Session  # noqa: F401
from v1.db.models.oauth_account import OAuthAccount  # noqa: F401  # ✅ OAuth model
from slowapi.middleware import SlowAPIMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from v1.core.rate_limit import limiter


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup/shutdown lifecycle.
    Creates database tables on startup.
    """
    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Cleanup on shutdown (if needed)


app = FastAPI(
    title="AugustLab Auth",
    version="1.0.0",
    description="Authentication and authorization service with FastAPI-Users",
    lifespan=lifespan,
    # Hide schemas from docs (Task 1)
    swagger_ui_parameters={
        "defaultModelsExpandDepth": -1,  # Hide schemas section
    }
)

# Attach limiter
app.state.limiter = limiter


# Rate limit exception handler
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Middleware
app.add_middleware(SlowAPIMiddleware)

api_v1_router = APIRouter(prefix="/v1")

# Include routers - Use consistent casing to avoid duplicates (Task 1)
api_v1_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_v1_router.include_router(users_router, prefix="/users", tags=["users"])
api_v1_router.include_router(auth_logs_router, prefix="/auth/logs", tags=["auth"])
api_v1_router.include_router(validator_router, prefix="/auth", tags=["auth"])
for r in oauth_routers:
    api_v1_router.include_router(r)


app.include_router(api_v1_router)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "message": "AugustLab Auth Service",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}