
import asyncio
import sys
import os
import traceback
from sqlalchemy import text
from app.v1.db.session import engine

async def apply_sql(sql_file: str):
    if not os.path.isabs(sql_file):
        sql_file = os.path.join(os.getcwd(), sql_file)
        
    print(f"Reading SQL from {sql_file}...")
    
    try:
        with open(sql_file, "r") as f:
            content = f.read()
        
        async with engine.begin() as conn:
            print(f"Executing SQL script...")
            # Split by semicolon and filter out empty statements
            statements = [s.strip() for s in content.split(";") if s.strip()]
            for statement in statements:
                await conn.execute(text(statement))
        
        print("SQL script applied successfully!")
    except Exception as e:
        traceback.print_exc()
        print(f"Error applying SQL: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python apply_sql.py <path_to_sql_file>")
        sys.exit(1)
    
    asyncio.run(apply_sql(sys.argv[1]))
