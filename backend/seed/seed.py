import asyncio
import os
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.v1.core.security import hash_password
from app.v1.db import Permission, Role, User
from app.v1.db.session import async_session_maker, init_db

SUPERADMIN_ROLE_NAME = "superadmin"
HR_ADMIN_ROLE_NAME = "hr_admin"
HR_USER_ROLE_NAME = "hr_user"

ADMIN_ROLE_NAME = os.getenv("ADMIN_ROLE_NAME", SUPERADMIN_ROLE_NAME)
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
ADMIN_FULL_NAME = os.getenv("ADMIN_FULL_NAME", "System Admin")
DEFAULT_PERMISSIONS = [
    {"name": "admin:all", "description": "Full administrative access."},
    {"name": "admin:access", "description": "Access to admin dashboard."},
    {"name": "users:read", "description": "View users list and details."},
    {"name": "users:manage", "description": "Create, update, and delete users."},
    {"name": "roles:read", "description": "View roles and their permissions."},
    {"name": "roles:manage", "description": "Create, update, and delete roles."},
    {"name": "permissions:read", "description": "View available permissions."},
    {"name": "permissions:manage", "description": "Create and delete permissions."},
    {"name": "jobs:access", "description": "View jobs list and details."},
    {"name": "jobs:manage", "description": "Create, update, and delete jobs."},
    {"name": "candidates:access", "description": "View candidate lists and candidate details."},
    {"name": "candidates:decide", "description": "Approve, reject, and update HR decisions for candidates."},
    {"name": "skills:access", "description": "View skills list and details."},
    {"name": "skills:manage", "description": "Create, update, and delete skills."},
    {"name": "departments:access", "description": "View departments list and details."},
    {"name": "departments:manage", "description": "Create, update, and delete departments."},
    {"name": "associates:access", "description": "View associates list and details."},
    {"name": "associates:manage", "description": "Create, update, and delete associates."},

    {"name": "audit:read", "description": "View system audit logs."},
    {"name": "files:read", "description": "View uploaded files and resumes."},
    {"name": "analytics:read", "description": "View hiring analytics and reports."},
    {"name": "questions:upload", "description": "Upload new Question Set Papers."},
    {"name": "questions:manage", "description": "Add, update, and delete individual questions within a paper."},
]

ROLE_PERMISSION_NAMES: dict[str, set[str]] = {
    SUPERADMIN_ROLE_NAME: {perm["name"] for perm in DEFAULT_PERMISSIONS},
    HR_ADMIN_ROLE_NAME: {
        "admin:access",
        "users:read",
        "users:manage",
        "roles:read",
        "roles:manage",
        "permissions:read",
        "permissions:manage",
        "jobs:access",
        "jobs:manage",
        "candidates:access",
        "candidates:decide",
        "skills:access",
        "skills:manage",
        "departments:access",
        "departments:manage",
        "associates:access",
        "associates:manage",

        "files:read",
        "analytics:read",
        "questions:upload",
        "questions:manage",
    },
    HR_USER_ROLE_NAME: {
        "jobs:access",
        "candidates:access",
        "candidates:decide",
        "questions:manage",
    },
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


async def ensure_permissions(session) -> list[Permission]:
    now = utc_now()

    # Get existing permissions
    existing_perms = (await session.execute(select(Permission))).scalars().all()
    existing_names = {p.name for p in existing_perms}

    new_permissions = []
    for perm_data in DEFAULT_PERMISSIONS:
        if perm_data["name"] not in existing_names:
            permission = Permission(
                name=perm_data["name"],
                description=perm_data["description"],
                created_at=now,
                updated_at=now,
            )
            session.add(permission)
            new_permissions.append(permission)

    if new_permissions:
        await session.flush()

    # Return all permissions (existing + new)
    all_perms = (await session.execute(select(Permission))).scalars().all()
    return list(all_perms)


async def ensure_role(
    session,
    role_name: str,
    permission_names: set[str],
    permissions_by_name: dict[str, Permission],
) -> Role:
    now = utc_now()
    role = (
        await session.execute(
            select(Role)
            .where(Role.name == role_name)
            .options(selectinload(Role.permissions)),
        )
    ).scalar_one_or_none()

    if not role:
        role = Role(
            name=role_name,
            created_at=now,
            updated_at=now,
        )
        session.add(role)
        await session.flush()
        await session.refresh(role, attribute_names=["permissions"])
    else:
        role.updated_at = now

    role.permissions = [
        permissions_by_name[name]
        for name in sorted(permission_names)
        if name in permissions_by_name
    ]

    await session.flush()
    return role


async def ensure_default_roles(
    session,
    permissions_by_name: dict[str, Permission],
) -> dict[str, Role]:
    roles: dict[str, Role] = {}

    for role_name, permission_names in ROLE_PERMISSION_NAMES.items():
        role = await ensure_role(
            session=session,
            role_name=role_name,
            permission_names=permission_names,
            permissions_by_name=permissions_by_name,
        )
        roles[role_name] = role

    if ADMIN_ROLE_NAME not in roles:
        roles[ADMIN_ROLE_NAME] = await ensure_role(
            session=session,
            role_name=ADMIN_ROLE_NAME,
            permission_names=ROLE_PERMISSION_NAMES[SUPERADMIN_ROLE_NAME],
            permissions_by_name=permissions_by_name,
        )

    return roles


async def ensure_admin_user(session, role: Role) -> User:
    now = utc_now()
    user = (
        await session.execute(
            select(User).where(User.email == ADMIN_EMAIL),
        )
    ).scalar_one_or_none()

    if user:
        user.full_name = ADMIN_FULL_NAME
        user.password_hash = hash_password(ADMIN_PASSWORD)
        user.is_active = True
        user.role_id = role.id
        user.updated_at = now
        await session.flush()
        return user

    user = User(
        email=ADMIN_EMAIL,
        full_name=ADMIN_FULL_NAME,
        password_hash=hash_password(ADMIN_PASSWORD),
        is_active=True,
        role_id=role.id,
        created_at=now,
        updated_at=now,
    )
    session.add(user)
    await session.flush()
    return user


async def main():
    await init_db()

    async with async_session_maker() as session:
        permissions = await ensure_permissions(session)
        permissions_by_name = {permission.name: permission for permission in permissions}
        roles = await ensure_default_roles(session, permissions_by_name)
        
        # 1. Ensure Superadmin
        superadmin_role = roles.get(ADMIN_ROLE_NAME, roles[SUPERADMIN_ROLE_NAME])
        admin_user = await ensure_admin_user(session, superadmin_role)
        
        # 2. Ensure HR Admin User
        hr_admin_role = roles[HR_ADMIN_ROLE_NAME]
        hr_admin_user = await ensure_user_with_role(
            session, 
            email="hr_admin@example.com", 
            full_name="HR Administrator", 
            password="admin123", 
            role=hr_admin_role
        )
        
        # 3. Ensure HR User
        hr_user_role = roles[HR_USER_ROLE_NAME]
        hr_user_user = await ensure_user_with_role(
            session, 
            email="hr_user@example.com", 
            full_name="HR Specialist", 
            password="admin123", 
            role=hr_user_role
        )
        
        await session.commit()

        print(f"Superadmin ready:  {admin_user.email}")
        print(f"HR Admin ready:    {hr_admin_user.email}")
        print(f"HR User ready:     {hr_user_user.email}")
        print("Default roles and users synced successfully.")


async def ensure_user_with_role(session, email, full_name, password, role) -> User:
    """Helper to ensure a user exists with a specific email and role."""
    from sqlalchemy import select
    now = utc_now()
    user = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
    
    if user:
        user.full_name = full_name
        user.password_hash = hash_password(password)
        user.role_id = role.id
        user.updated_at = now
    else:
        user = User(
            email=email,
            full_name=full_name,
            password_hash=hash_password(password),
            role_id=role.id,
            is_active=True,
            created_at=now,
            updated_at=now
        )
        session.add(user)
    
    await session.flush()
    return user


if __name__ == "__main__":
    asyncio.run(main())
