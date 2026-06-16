from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB

from config import DATABASE_URL

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
Base = declarative_base()

class DbCustomTemplate(Base):
    __tablename__ = "custom_templates"
    id: Mapped[str] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column()
    category: Mapped[str] = mapped_column()
    source: Mapped[str] = mapped_column()
    fields_data: Mapped[list] = mapped_column(type_=JSONB)

class DbTokenStore(Base):
    __tablename__ = "token_store"
    key: Mapped[str] = mapped_column(primary_key=True)
    token: Mapped[str] = mapped_column()
    
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
