from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


@lru_cache
def get_engine() -> Engine:
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is not configured")
    kwargs: dict = {"pool_pre_ping": True}
    if settings.database_url.startswith("postgresql"):
        kwargs.update(
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            pool_timeout=settings.db_pool_timeout,
            pool_recycle=settings.db_pool_recycle,
        )
        if settings.db_pgbouncer:
            # Transaction pooling cannot keep server-side prepared statements.
            kwargs["connect_args"] = {"prepare_threshold": None}
    return create_engine(settings.database_url, **kwargs)


@lru_cache
def _session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def SessionLocal() -> Session:  # noqa: N802
    return _session_factory()()


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
