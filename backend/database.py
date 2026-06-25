from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import String, DateTime, Boolean, func, text

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

class DbRecentRecord(Base):
    __tablename__ = "recent_records"
    id: Mapped[str] = mapped_column(primary_key=True)
    user_email: Mapped[str] = mapped_column(String(255), index=True)
    owner_email: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    owner_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    source: Mapped[str | None] = mapped_column(String(30), default="recording", nullable=True)
    template_name: Mapped[str] = mapped_column(String(255))
    customer_name: Mapped[str] = mapped_column(String(255))
    confidence: Mapped[int] = mapped_column()
    status: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DbWorkspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_email: Mapped[str] = mapped_column(String(255), index=True)
    name: Mapped[str] = mapped_column(String(255))
    template_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    template_source: Mapped[str] = mapped_column(String(20), default="builtin")
    template_data: Mapped[dict] = mapped_column(type_=JSONB)
    language: Mapped[str] = mapped_column(String(20), default="hi-IN")
    sheet_sync_mode: Mapped[str] = mapped_column(String(20), default="new")
    target_sheet_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    extraction_rules: Mapped[str] = mapped_column(String(20), default="Standard")
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_opened_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DbUserAuth(Base):
    __tablename__ = "user_auth"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    primary_provider: Mapped[str] = mapped_column(String(20), default="manual")
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    google_avatar: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    google_linked: Mapped[bool] = mapped_column(Boolean, default=False)
    password_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    password_salt: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reset_token_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    reset_token_expires_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class DbLlmLog(Base):
    __tablename__ = "llm_logs"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    model_name: Mapped[str] = mapped_column(String(100))
    flow: Mapped[str] = mapped_column(String(100))
    token_usage: Mapped[dict] = mapped_column(type_=JSONB)
    latency_ms: Mapped[int] = mapped_column()
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # Backfill columns for existing deployments without requiring Alembic.
        if engine.url.get_backend_name().startswith("postgresql"):
            await conn.execute(text("ALTER TABLE IF EXISTS user_auth ADD COLUMN IF NOT EXISTS primary_provider VARCHAR(20)"))
            await conn.execute(text("ALTER TABLE IF EXISTS user_auth ADD COLUMN IF NOT EXISTS google_avatar VARCHAR(1024)"))
            await conn.execute(text("ALTER TABLE IF EXISTS user_auth ADD COLUMN IF NOT EXISTS google_linked BOOLEAN DEFAULT FALSE"))
            await conn.execute(text("ALTER TABLE IF EXISTS user_auth ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(128)"))
            await conn.execute(text("ALTER TABLE IF EXISTS user_auth ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ"))
            await conn.execute(text("ALTER TABLE IF EXISTS user_auth ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()"))
            await conn.execute(text("ALTER TABLE IF EXISTS user_auth ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()"))

            await conn.execute(text("UPDATE user_auth SET primary_provider = COALESCE(primary_provider, 'manual')"))
            await conn.execute(text("UPDATE user_auth SET google_linked = CASE WHEN primary_provider = 'google' THEN TRUE ELSE COALESCE(google_linked, FALSE) END"))
            await conn.execute(text("UPDATE user_auth SET created_at = COALESCE(created_at, NOW())"))
            await conn.execute(text("UPDATE user_auth SET updated_at = COALESCE(updated_at, NOW())"))

            await conn.execute(text("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'user_auth' AND column_name = 'provider'
                ) THEN
                    EXECUTE 'UPDATE user_auth SET primary_provider = COALESCE(primary_provider, provider, ''manual'')';
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'user_auth' AND column_name = 'avatar'
                ) THEN
                    EXECUTE 'UPDATE user_auth SET google_avatar = COALESCE(google_avatar, avatar)';
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'user_auth' AND column_name = 'provider'
                ) THEN
                    EXECUTE 'UPDATE user_auth SET provider = COALESCE(provider, primary_provider, ''manual'')';
                    EXECUTE 'ALTER TABLE user_auth ALTER COLUMN provider SET DEFAULT ''manual''';
                    EXECUTE 'ALTER TABLE user_auth ALTER COLUMN provider DROP NOT NULL';
                END IF;
            END
            $$;
            """))

            # Preserve compatibility by keeping old columns, but ensure a unique email index for linked identities.
            await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ux_user_auth_email ON user_auth (email)"))

            # Backfill workspace columns for incremental deployments.
            await conn.execute(text("ALTER TABLE IF EXISTS workspaces ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE"))

            # Backfill recent_records owner/source columns for incremental deployments.
            await conn.execute(text("ALTER TABLE IF EXISTS recent_records ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255)"))
            await conn.execute(text("ALTER TABLE IF EXISTS recent_records ADD COLUMN IF NOT EXISTS owner_name VARCHAR(120)"))
            await conn.execute(text("ALTER TABLE IF EXISTS recent_records ADD COLUMN IF NOT EXISTS source VARCHAR(30) DEFAULT 'recording'"))
            await conn.execute(text("UPDATE recent_records SET owner_email = COALESCE(owner_email, user_email)"))
            await conn.execute(text("UPDATE recent_records SET source = COALESCE(NULLIF(source, ''), 'recording')"))
