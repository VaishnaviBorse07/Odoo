from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

settings = get_settings()

_engine_kw: dict = {"echo": False, "pool_pre_ping": True}
if settings.DB_SEARCH_PATH.strip():
    _engine_kw["connect_args"] = {
        "server_settings": {"search_path": settings.DB_SEARCH_PATH.strip()},
    }

engine = create_async_engine(settings.DATABASE_URL, **_engine_kw)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
