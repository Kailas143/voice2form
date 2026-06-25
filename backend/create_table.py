import asyncio
from database import engine, Base
import database # To ensure models are loaded

async def create():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("Tables created.")

asyncio.run(create())
