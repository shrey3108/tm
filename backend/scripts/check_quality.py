
import asyncio
from app.v1.db.session import engine
from sqlalchemy import select
from app.v1.db.models.transcripts import Transcript

async def check():
    async with engine.connect() as conn:
        res = await conn.execute(
            select(Transcript).where(Transcript.id == '019dbe73-ef12-70e8-adc3-22c5eb6c4bc1')
        )
        row = res.fetchone()
        if row:
            # Check for filler words and repetitions
            text = row.clean_transcript_text
            print(f"Text Preview: {text[:1000]}")
            
            # Check for timestamps in the text
            if re.search(r'\d{1,2}:\d{2}', text):
                print("FOUND TIMESTAMPS IN TEXT")
            else:
                print("NO TIMESTAMPS IN TEXT")
                
            # Check for common fillers
            for word in ["ok", "hmm", "mhm"]:
                if f" {word} " in text.lower():
                    print(f"FOUND FILLER: {word}")

import re
if __name__ == "__main__":
    asyncio.run(check())
