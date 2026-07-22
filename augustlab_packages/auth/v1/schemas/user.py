"""
User schemas for API (public fields only).
Task 2 Solution: Hide is_active, is_superuser, is_verified from registration endpoint.
"""
import uuid
from typing import Optional, Any, Dict
from pydantic import BaseModel, EmailStr, Field
from fastapi_users import schemas


class CustomUserRead(schemas.BaseUser[uuid.UUID]):
    """
    Public user read schema (fields visible in Swagger).
    Inherits from FastAPI-Users BaseUser for proper integration.
    """
    users_name: str
    organization_id: uuid.UUID


class CustomUserCreate(schemas.BaseUserCreate):
    """
    User create schema for registration.
    
    WORKING SOLUTION for Task 2:
    - Inherits from BaseUserCreate (required for FastAPI-Users compatibility)
    - Makes boolean fields optional with defaults (hides from required fields)
    - Uses model_json_schema to customize OpenAPI documentation
    """
    email: EmailStr
    password: str = Field(..., min_length=8)
    users_name: str = Field(..., description="User's full name")

    # Hide these fields from OpenAPI docs
    is_active: bool = Field(default=True, exclude=True)
    is_superuser: bool = Field(default=False, exclude=True)
    is_verified: bool = Field(default=False, exclude=True)

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "email": "user@example.com",
                    "password": "string",
                    "users_name": "string"
                }
            ],
            "properties": {
                "email": {"title": "Email"},
                "password": {"title": "Password"},
                "users_name": {"title": "User's full name"}
            },
            "required": ["email", "password", "users_name"]
        }
    }

    @classmethod
    def model_json_schema(
        cls,
        by_alias: bool = True,
        ref_template: str = '#/$defs/{model}',
        schema_generator=None,
        mode: str = 'validation',
    ) -> Dict[str, Any]:
        """
        Customize the JSON schema to hide unwanted fields from Swagger UI.
        """
        schema = super().model_json_schema(
            by_alias=by_alias,
            ref_template=ref_template,
            schema_generator=schema_generator,
            mode=mode,
        )
        # Remove unwanted fields from schema
        for field in ["is_active", "is_superuser", "is_verified"]:
            schema.get("properties", {}).pop(field, None)
        schema["required"] = ["email", "password", "users_name"]
        schema["example"] = {
            "email": "user@example.com",
            "password": "string",
            "users_name": "string"
        }
        return schema


class CustomUserUpdate(schemas.BaseUserUpdate):
    """
    User update schema (fields visible in Swagger).
    Inherits from FastAPI-Users BaseUserUpdate for proper integration.
    """
    users_name: Optional[str] = None