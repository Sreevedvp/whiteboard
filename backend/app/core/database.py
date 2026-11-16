import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

logger = logging.getLogger("uvicorn.error")

FALLBACK_SQLITE_URL = "sqlite+aiosqlite:///./whiteboard.db"


class Base(DeclarativeBase):
    pass


def create_engine_and_session(db_url: str):
    connect_args = {}
    if db_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False

    eng = create_async_engine(
        db_url,
        echo=False,
        future=True,
        pool_pre_ping=True,
        connect_args=connect_args
    )
    session_factory = async_sessionmaker(
        bind=eng,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False
    )
    return eng, session_factory


# Initialize default engine with configured DATABASE_URL
engine, AsyncSessionLocal = create_engine_and_session(settings.DATABASE_URL)


async def init_db():
    """
    Attempts to initialize tables using configured PostgreSQL DATABASE_URL.
    If PostgreSQL is unreachable (e.g., local dev without running Postgres daemon),
    automatically falls back to local SQLite so the developer can run immediately.
    """
    global engine, AsyncSessionLocal
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info(f"Connected to primary database: {settings.DATABASE_URL.split('@')[-1]}")
    except Exception as e:
        if "postgresql" in settings.DATABASE_URL:
            logger.warning(
                f"⚠️ Unable to reach PostgreSQL at {settings.DATABASE_URL.split('@')[-1]}: {e}\n"
                f"🔄 Automatically falling back to local SQLite: {FALLBACK_SQLITE_URL}\n"
                f"💡 (To use PostgreSQL, start PostgreSQL and update DATABASE_URL in backend/.env)"
            )
            # Switch to SQLite fallback
            engine, AsyncSessionLocal = create_engine_and_session(FALLBACK_SQLITE_URL)
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Local SQLite database initialized successfully.")
        else:
            logger.error(f"Failed to initialize database: {e}")
            raise


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
