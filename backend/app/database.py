import sqlite3
from typing import Optional

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

from app.config import settings


def create_database_engine(
    database_url: str,
    *,
    pool_recycle_seconds: Optional[int] = None,
    pool_size: Optional[int] = None,
    max_overflow: Optional[int] = None,
    pool_timeout_seconds: Optional[int] = None,
) -> Engine:
    engine_kwargs: dict = {"pool_pre_ping": True}

    # MySQL: force utf8mb4 on the connection so 4-byte characters - emoji, and
    # some names and pasted content - store instead of raising "Incorrect string
    # value". The database and tables must also be utf8mb4; this pins the client
    # side. pool_recycle keeps connections under MySQL's wait_timeout, which is
    # the common cause of "login works, then 500s after idle hours" outages.
    if database_url.startswith("mysql"):
        engine_kwargs["connect_args"] = {"charset": "utf8mb4"}
        engine_kwargs["pool_recycle"] = pool_recycle_seconds or settings.db_pool_recycle_seconds
        engine_kwargs["pool_size"] = pool_size or settings.db_pool_size
        engine_kwargs["max_overflow"] = max_overflow or settings.db_max_overflow
        engine_kwargs["pool_timeout"] = pool_timeout_seconds or settings.db_pool_timeout_seconds

    database_engine = create_engine(database_url, **engine_kwargs)

    if database_engine.dialect.name == "sqlite":
        @event.listens_for(database_engine, "connect")
        def enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
            if isinstance(dbapi_connection, sqlite3.Connection):
                cursor = dbapi_connection.cursor()
                cursor.execute("PRAGMA foreign_keys=ON")
                cursor.close()

    return database_engine


engine = create_database_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
