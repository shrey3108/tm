from typing import Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class RoleConfigRequest(BaseModel):
    """Payload to create or update category weights for a job role."""

    role_name: str = Field(
        ...,
        examples=["Python AI Engineer"],
        description="The job title/role identifier",
    )
    weights: Dict[str, float] = Field(
        ...,
        description="Weights dictionary mapping category name to float (0.0 to 1.0)",
        examples=[
            {
                "correctness": 0.30,
                "code_quality": 0.25,
                "architecture": 0.20,
                "security": 0.10,
                "performance": 0.10,
                "documentation": 0.15,
            }
        ],
    )
    default_skills: Optional[List[str]] = Field(
        None,
        description="Optional default job skills to evaluate when candidate repository is submitted",
        examples=[["Python", "FastAPI", "LangChain"]],
    )

    @field_validator("weights")
    @classmethod
    def validate_weights(cls, w: Dict[str, float]) -> Dict[str, float]:
        required_categories = {
            "correctness",
            "code_quality",
            "architecture",
            "security",
            "performance",
            "documentation",
        }
        missing = required_categories - set(w.keys())
        if missing:
            raise ValueError(f"Weights dictionary is missing categories: {missing}")

        total = sum(w.values())
        if abs(total - 1.0) > 1e-6:
            raise ValueError(
                f"Weights must sum to exactly 1.0 (currently sum is {total})"
            )

        for cat, val in w.items():
            if not (0.0 <= val <= 1.0):
                raise ValueError(f"Weight for '{cat}' must be between 0.0 and 1.0")

        return w


class RoleConfigResponse(BaseModel):
    """Response representing active category weights configuration."""

    role_name: str
    weights: Dict[str, float]
    default_skills: Optional[List[str]] = None
    version: int
