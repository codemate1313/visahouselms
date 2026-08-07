import sqlite3

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

from app.config import settings


def create_database_engine(database_url: str) -> Engine:
    engine_kwargs: dict = {"pool_pre_ping": True}

    # MySQL: force utf8mb4 on the connection so 4-byte characters - emoji, and
    # some names and pasted content - store instead of raising "Incorrect string
    # value". The database and tables must also be utf8mb4; this pins the client
    # side. pool_recycle keeps connections under MySQL's wait_timeout.
    if database_url.startswith("mysql"):
        engine_kwargs["connect_args"] = {"charset": "utf8mb4"}
        engine_kwargs["pool_recycle"] = 3600

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
