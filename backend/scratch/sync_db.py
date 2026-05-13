import asyncio
import sys
import os

# PYTHONPATH set karo taki app import ho sake
sys.path.append(os.getcwd())

from app.v1.db.session import init_db

async def main():
    print("Syncing Database (Creating missing tables)...")
    try:
        await init_db()
        print("Database synced successfully. 'system_settings' table should be ready.")
    except Exception as e:
        print(f"Error syncing database: {e}")

if __name__ == "__main__":
    asyncio.run(main())
