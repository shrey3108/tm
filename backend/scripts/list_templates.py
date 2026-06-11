
import asyncio
from app.v1.db.session import engine
from sqlalchemy import select
from app.v1.db.models.stage_templates import StageTemplate

async def check():
    async with engine.connect() as conn:
        res = await conn.execute(select(StageTemplate))
        rows = res.fetchall()
        for t in rows:
            default_status = "DEFAULT" if getattr(t, "is_default", False) else "Standard"
            order = getattr(t, "default_order", "-")
            print(f"[{default_status} | Order: {order}] ID: {t.id}, Name: {t.name}")

if __name__ == "__main__":
    asyncio.run(check())
