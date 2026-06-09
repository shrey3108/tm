"""
Apply Criterion Versioning migration.
Run this script once to apply schema changes.

Usage:
    cd d:\\hirego
    .venv\\Scripts\\python backend/apply_criterion_migration.py
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text
from app.v1.db.session import engine

# Execute each statement as an independent transaction-safe block.
# Avoids semicolon-splitting issues with DO $$ ... $$ blocks.
STATEMENTS = [
    # 1. Add version column (idempotent)
    "ALTER TABLE criteria ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1",

    # 2. Create criterion_versions table (idempotent)
    """
    CREATE TABLE IF NOT EXISTS criterion_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        criterion_id UUID NOT NULL REFERENCES criteria(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        prompt_text TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,

    # 3. Index on criterion_id (idempotent)
    "CREATE INDEX IF NOT EXISTS idx_criterion_versions_criterion_id ON criterion_versions(criterion_id)",

    # 4. Unique index on (criterion_id, version_number) (idempotent)
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_criterion_versions_unique ON criterion_versions(criterion_id, version_number)",

    # 5. Back-fill version 1 snapshots for existing criteria with no snapshot
    """
    INSERT INTO criterion_versions (id, criterion_id, version_number, name, description, prompt_text, created_at)
    SELECT
        gen_random_uuid(),
        c.id,
        1,
        c.name,
        c.description,
        c.prompt_text,
        c.created_at
    FROM criteria c
    WHERE NOT EXISTS (
        SELECT 1 FROM criterion_versions cv WHERE cv.criterion_id = c.id
    )
    """,
]


async def apply_migration():
    print("Applying Criterion Versioning migration...\n")
    async with engine.begin() as conn:
        for i, stmt in enumerate(STATEMENTS, 1):
            clean = stmt.strip()
            preview = " ".join(clean.split())[:70]
            print(f"  [{i}/{len(STATEMENTS)}] {preview}...")
            await conn.execute(text(clean))

    print("\n[SUCCESS] Migration applied successfully!")
    print("   * Added 'version' column to criteria table (default 1)")
    print("   * Created criterion_versions table")
    print("   * Created indexes on criterion_versions")
    print("   * Back-filled v1 snapshots for all existing criteria")


if __name__ == "__main__":
    asyncio.run(apply_migration())
