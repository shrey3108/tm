"""Bootstrap access to the embedded AugustLab auth package."""

from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import select, text


AUTH_PACKAGE_ROOT = Path(__file__).resolve().parents[4] / "augustlab_packages" / "auth"


def bootstrap_auth_package() -> Path:
    """Ensure the local auth package is importable via its top-level ``v1`` package."""
    auth_path = AUTH_PACKAGE_ROOT.resolve()
    auth_path_str = str(auth_path)

    if auth_path_str not in sys.path:
        sys.path.insert(0, auth_path_str)

    return auth_path


async def initialize_auth_package() -> None:
    """Create auth package tables and seed the default organization for embedded use."""
    bootstrap_auth_package()

    from v1.core.config import settings as auth_settings
    from v1.db.base import Base as AuthBase
    from v1.db.models.auth_log import AuthLog  # noqa: F401
    from v1.db.models.oauth_account import OAuthAccount  # noqa: F401
    from v1.db.models.organization import Organization
    from v1.db.models.organization_settings import OrganizationSettings  # noqa: F401
    from v1.db.models.session import Session  # noqa: F401
    from v1.db.models.subscription_package import SubscriptionPackage  # noqa: F401
    from v1.db.models.user import User  # noqa: F401
    from v1.db.session import AsyncSessionLocal, engine as auth_engine

    async with auth_engine.begin() as conn:
        schema_name = getattr(auth_settings, "DB_SCHEMA", "auth")
        await conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name};"))
        await conn.run_sync(AuthBase.metadata.create_all)

    async with AsyncSessionLocal() as session:
        organization = await session.get(
            Organization,
            auth_settings.DEFAULT_ORGANIZATION_ID,
        )
        if organization is None:
            session.add(
                Organization(
                    organization_id=auth_settings.DEFAULT_ORGANIZATION_ID,
                    organization_name="Default Organization",
                )
            )
            await session.commit()