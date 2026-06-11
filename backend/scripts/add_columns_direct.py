import asyncio
import asyncpg

async def main():
    try:
        print("Attempting to connect to postgres://postgres:root@localhost/app2")
        conn = await asyncpg.connect(user='postgres', password='root', database='app2', host='localhost')
        print("Connected to database.")
        
        # Ensure job_priorities exists first just in case
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS job_priorities (
                id UUID PRIMARY KEY,
                name TEXT NOT NULL,
                duration_days INTEGER NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)
        print("Ensured job_priorities table exists.")

        await conn.execute("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS priority_id UUID REFERENCES job_priorities(id) ON DELETE SET NULL;")
        print("Handled priority_id column")
        await conn.execute("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS priority_start_date DATE;")
        print("Handled priority_start_date column")
        await conn.execute("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS priority_end_date DATE;")
        print("Handled priority_end_date column")
        
        await conn.close()
        print("Database update successful.")
    except Exception as e:
        print(f"Database update failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
