"""Quick check: does associate_evaluations table exist and have records?

Uses asyncpg directly to avoid importing the full app (which pulls in torch etc.).
"""
import asyncio
import asyncpg

DB_DSN = "postgresql://postgres:root@localhost:5432/a"


async def check():
    conn = await asyncpg.connect(DB_DSN)
    try:
        # Check if table exists
        row = await conn.fetchval(
            "SELECT to_regclass('public.associate_evaluations')"
        )
        table_exists = row is not None
        print(f"TABLE EXISTS: {table_exists}")

        if not table_exists:
            print(">>> Table does not exist! Run the migration SQL first:")
            print(">>>   cd backend && python scripts/apply_sql.py migrations/create_associate_evaluations_table.sql")
            return

        # Check for records
        rows = await conn.fetch(
            "SELECT id, review_token, status, sent_at FROM associate_evaluations LIMIT 10"
        )
        if rows:
            print(f"RECORDS FOUND: {len(rows)}")
            for r in rows:
                print(f"  id={r['id']}, token={r['review_token']}, status={r['status']}, sent_at={r['sent_at']}")
        else:
            print(">>> NO RECORDS in table. The send-to-associates endpoint may not have been called after the code changes.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(check())
