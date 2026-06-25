import asyncio
import sys
from database import AsyncSessionLocal
from sqlalchemy import text

async def check():
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(text("SELECT count(*) FROM llm_logs"))
            print("Count of llm_logs:", result.scalar())
        except Exception as e:
            print("Error:", e)

asyncio.run(check())
