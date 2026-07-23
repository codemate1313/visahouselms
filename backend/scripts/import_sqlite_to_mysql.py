"""Import all data from visahouselms-dev.db (SQLite) into MySQL database.

Usage:
    cd backend
    PYTHONPATH=. .venv/bin/python scripts/import_sqlite_to_mysql.py
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path
from datetime import datetime, date

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from sqlalchemy import create_engine, MetaData, Table, text, select
from sqlalchemy.engine import Engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("sqlite_to_mysql")

SQLITE_DB_PATH = Path(__file__).resolve().parent.parent / "visahouselms-dev.db"

def parse_datetime(val: str | None) -> datetime | None:
    if not val:
        return None
    val_str = str(val).strip()
    if val_str.endswith("Z"):
        val_str = val_str[:-1]
    # Remove fractional seconds if needed or parse standard formats
    for fmt in (
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d",
    ):
        try:
            return datetime.strptime(val_str, fmt)
        except ValueError:
            pass
    return None

def main():
    if not SQLITE_DB_PATH.exists():
        logger.error(f"SQLite database file not found: {SQLITE_DB_PATH}")
        sys.exit(1)

    logger.info(f"Source SQLite DB: {SQLITE_DB_PATH}")
    logger.info(f"Target MySQL DB URL: {settings.database_url}")

    sqlite_engine = create_engine(f"sqlite:///{SQLITE_DB_PATH}")
    mysql_engine = create_engine(settings.database_url)

    # Reflect metadata from both
    sqlite_meta = MetaData()
    sqlite_meta.reflect(bind=sqlite_engine)

    mysql_meta = MetaData()
    mysql_meta.reflect(bind=mysql_engine)

    logger.info("Disabling MySQL foreign key checks...")
    with mysql_engine.begin() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))

    # Table insertion order (dependencies first, or foreign key disabled allows any order)
    # Order by sqlite_meta.sorted_tables where available
    sorted_tables = sqlite_meta.sorted_tables

    total_migrated_tables = 0
    total_migrated_rows = 0

    with mysql_engine.begin() as mysql_conn:
        mysql_conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))

        for sqlite_table in sorted_tables:
            t_name = sqlite_table.name
            if t_name == "alembic_version" or t_name.startswith("sqlite_"):
                continue

            if t_name not in mysql_meta.tables:
                logger.warning(f"Table '{t_name}' in SQLite is not present in MySQL schema. Skipping.")
                continue

            mysql_table = mysql_meta.tables[t_name]

            # Truncate / delete existing rows in target table
            mysql_conn.execute(text(f"TRUNCATE TABLE `{t_name}`"))

            # Fetch rows from SQLite
            with sqlite_engine.connect() as sqlite_conn:
                rows = sqlite_conn.execute(select(sqlite_table)).mappings().all()

            if not rows:
                logger.info(f"Table '{t_name}': 0 rows (cleared target)")
                continue

            # Prepare data for insertion into MySQL
            mysql_cols = {col.name: col for col in mysql_table.columns}
            insert_records = []

            for row in rows:
                record = {}
                for col_name, col_obj in mysql_cols.items():
                    if col_name not in row:
                        continue
                    val = row[col_name]
                    # Data type sanitization for MySQL compatibility
                    col_type_name = str(col_obj.type).upper()
                    if val is not None:
                        if "DATETIME" in col_type_name or "TIMESTAMP" in col_type_name:
                            if isinstance(val, str):
                                val = parse_datetime(val)
                        elif "JSON" in col_type_name:
                            import json
                            if isinstance(val, (dict, list)):
                                pass # SQLAlchemy JSON handles dict/list
                            elif isinstance(val, str):
                                try:
                                    val = json.loads(val)
                                except Exception:
                                    pass
                    record[col_name] = val
                insert_records.append(record)

            if insert_records:
                # Insert in chunks of 500
                chunk_size = 500
                for i in range(0, len(insert_records), chunk_size):
                    chunk = insert_records[i : i + chunk_size]
                    mysql_conn.execute(mysql_table.insert(), chunk)

            count = len(insert_records)
            total_migrated_tables += 1
            total_migrated_rows += count
            logger.info(f"Migrated table '{t_name}': {count} rows")

        mysql_conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))

    logger.info(f"\nSuccessfully migrated {total_migrated_rows} rows across {total_migrated_tables} tables into MySQL!")

if __name__ == "__main__":
    main()
