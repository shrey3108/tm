from fastapi import APIRouter, HTTPException, Query, status
from github_code_evaluator.app.v1.core.config import settings
from github_code_evaluator.app.v1.core.security import generate_test_token

router = APIRouter()


@router.get("/token", response_model=dict)
def get_dev_token(
    sub: str = Query(default="admin", description="Subject claim for the token"),
    role: str = Query(default="admin", description="Role claim for the token (admin, reviewer, or user)"),
):
    """Generate a valid development Bearer token.
    
    This endpoint is only available in development environment mode.
    """
    if settings.ENVIRONMENT != "development":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token generation endpoint is only available in development mode.",
        )
    
    if role not in ("admin", "reviewer", "user"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role. Must be 'admin', 'reviewer', or 'user'."
        )
        
    token = generate_test_token({"sub": sub, "role": role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "sub": sub,
        "role": role
    }
