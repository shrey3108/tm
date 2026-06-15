from fastapi import APIRouter

from github_code_evaluator.app.v1.endpoints.auth import router as auth_router
from github_code_evaluator.app.v1.endpoints.configs import router as configs_router
from github_code_evaluator.app.v1.endpoints.logs import router as logs_router
from github_code_evaluator.app.v1.endpoints.reports import router as reports_router
from github_code_evaluator.app.v1.endpoints.repositories import router as repositories_router

api_router = APIRouter()

# Register routes with matching prefixes
api_router.include_router(
    auth_router, prefix="/auth", tags=["auth"]
)
api_router.include_router(
    repositories_router, prefix="/repositories", tags=["repositories"]
)
api_router.include_router(
    reports_router, prefix="/evaluations", tags=["evaluations"]
)
api_router.include_router(
    configs_router, prefix="/configs", tags=["configs"]
)
api_router.include_router(
    logs_router, prefix="/logs", tags=["logs"]
)

