
import asyncio
import os
from sqlalchemy import text
from app.v1.db.session import engine

async def apply_migration():
    migration_file = "migrations/add_job_priorities_and_priority_columns.sql"
    print(f"Reading migration from {migration_file}...")
    
    with open(migration_file, "r") as f:
        content = f.read()
    
    # Split by double newline which separates our sections in the SQL file
    # Or just execute the specific blocks.
    # 1. Create table
    # 2. DO block for columns
    # 3. DO block for constraints
    # 4. INSERT
    
    blocks = [
        # Block 1: Create Table
        """
        CREATE TABLE IF NOT EXISTS job_priorities (
            id UUID PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            duration_days INTEGER NOT NULL,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        );
        """,
        # Block 2: Add Columns
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='priority_id') THEN
                ALTER TABLE jobs ADD COLUMN priority_id UUID;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='priority_start_date') THEN
                ALTER TABLE jobs ADD COLUMN priority_start_date TIMESTAMP WITHOUT TIME ZONE;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='priority_end_date') THEN
                ALTER TABLE jobs ADD COLUMN priority_end_date TIMESTAMP WITHOUT TIME ZONE;
            END IF;
        END $$;
        """,
        # Block 3: Add FK
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fk_jobs_priority_id_job_priorities') THEN
                ALTER TABLE jobs 
                ADD CONSTRAINT fk_jobs_priority_id_job_priorities 
                FOREIGN KEY (priority_id) REFERENCES job_priorities(id);
            END IF;
        END $$;
        """,
        # Block 4: Seed
        """
        INSERT INTO job_priorities (id, name, duration_days, created_at, updated_at)
        VALUES 
            ('4b9e7d9b-8e3b-4c4b-8e3b-4c4b8e3b4c4b', 'P1', 30, NOW(), NOW()),
            ('5c0f8e0c-9f4c-5d5c-9f4c-5d5c9f4c5d5c', 'P2', 60, NOW(), NOW()),
            ('6d1a9f1d-0a5d-6e6d-0a5d-6e6d0a5d6e6d', 'P3', 90, NOW(), NOW())
        ON CONFLICT (name) DO NOTHING;
        """
    ]
    
    print("Applying migration blocks...")
    async with engine.begin() as conn:
        for block in blocks:
            print(f"Executing block...")
            await conn.execute(text(block))
    
    print("Migration applied successfully!")

if __name__ == "__main__":
    asyncio.run(apply_migration())
