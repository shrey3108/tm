from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from github_code_evaluator.app.v1.core.security import get_current_user
from github_code_evaluator.app.v1.db.models.role_config import RoleWeightConfig
from github_code_evaluator.app.v1.db.session import get_db
from github_code_evaluator.app.v1.schemas.config import RoleConfigRequest, RoleConfigResponse
from github_code_evaluator.app.v1.services.scoring import DEFAULT_WEIGHTS

router = APIRouter()


@router.get("/weights", response_model=List[RoleConfigResponse])
async def list_role_weight_configs(
    role_name: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Retrieve all customized role weights configurations from the database."""
    stmt = select(RoleWeightConfig)
    if role_name:
        stmt = stmt.where(RoleWeightConfig.role_name.ilike(f"%{role_name.strip()}%"))
        
    result = await db.execute(stmt)
    configs = result.scalars().all()
    
    response = [
        RoleConfigResponse(
            role_name=c.role_name,
            weights=c.weights,
            default_skills=c.default_skills,
            version=c.version,
        )
        for c in configs
    ]
    
    # If empty (either DB is empty, or no matches found but "default" matches the search query)
    if not response:
        if not role_name or role_name.strip().lower() in "default":
            response.append(
                RoleConfigResponse(
                    role_name="default",
                    weights=DEFAULT_WEIGHTS,
                    default_skills=None,
                    version=1,
                )
            )
        
    return response


@router.get("/weights/{role_name}", response_model=RoleConfigResponse)
async def get_role_weight_config(
    role_name: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Retrieve the weight configuration for a specific role.

    Falls back to returning system default weights if not custom-configured.
    """
    result = await db.execute(
        select(RoleWeightConfig).where(RoleWeightConfig.role_name == role_name)
    )
    config = result.scalar_one_or_none()

    if config:
        return RoleConfigResponse(
            role_name=config.role_name,
            weights=config.weights,
            default_skills=config.default_skills,
            version=config.version,
        )
    
    # Return default weights fallback
    return RoleConfigResponse(
        role_name=role_name,
        weights=DEFAULT_WEIGHTS,
        default_skills=None,
        version=1,
    )


@router.post("/weights", response_model=RoleConfigResponse)
async def save_role_weight_config(
    payload: RoleConfigRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Create or update weights for a target job role."""
    # Restrict to admins
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can configure weights",
        )

    result = await db.execute(
        select(RoleWeightConfig).where(RoleWeightConfig.role_name == payload.role_name)
    )
    config = result.scalar_one_or_none()

    if config:
        config.weights = payload.weights
        if payload.default_skills is not None:
            config.default_skills = payload.default_skills
        config.version += 1
    else:
        # Create new config
        config = RoleWeightConfig(
            role_name=payload.role_name,
            weights=payload.weights,
            default_skills=payload.default_skills,
            version=1,
        )
        db.add(config)

    await db.commit()
    await db.refresh(config)

    return RoleConfigResponse(
        role_name=config.role_name,
        weights=config.weights,
        default_skills=config.default_skills,
        version=config.version,
    )
