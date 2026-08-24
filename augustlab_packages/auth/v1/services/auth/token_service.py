"""
Token service.
Handles JWT creation and validation.
"""
from fastapi import HTTPException
from v1.db.models.user import User
from v1.core.auth import get_jwt_strategy


class TokenService:
    """
    JWT access token handling.
    """

    async def create_access_token(self, user: User) -> str:
        jwt_strategy = get_jwt_strategy()
        return await jwt_strategy.write_token(user)

    async def verify_token(self, token: str) -> User:
        jwt_strategy = get_jwt_strategy()

        user = await jwt_strategy.read_token(
            token=token,
            user_manager=None,
        )

        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")

        return user
