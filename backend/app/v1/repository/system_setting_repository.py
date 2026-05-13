from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.v1.db.models.system_settings import SystemSetting

class SystemSettingRepository:
    async def get_value(self, db: AsyncSession, key: str, default: str = None) -> str:
        """Fetch a setting value by key."""
        stmt = select(SystemSetting.value).where(SystemSetting.key == key)
        result = await db.execute(stmt)
        value = result.scalar_one_or_none()
        return value if value is not None else default

    async def set_value(self, db: AsyncSession, key: str, value: str, description: str = None) -> SystemSetting:
        """Create or update a setting value."""
        stmt = select(SystemSetting).where(SystemSetting.key == key)
        result = await db.execute(stmt)
        setting = result.scalar_one_or_none()

        if setting:
            setting.value = value
            if description:
                setting.description = description
        else:
            setting = SystemSetting(key=key, value=value, description=description)
            db.add(setting)
        
        await db.commit()
        return setting

system_setting_repository = SystemSettingRepository()
