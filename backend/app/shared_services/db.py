from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Any, Iterator

from dotenv import load_dotenv
import psycopg2
from psycopg2 import errors as pg_errors
from psycopg2.extras import RealDictCursor

from .logger_setup import setup_logger

load_dotenv()

logger = setup_logger()


def get_postgres_connection(table_name: str = None):
    """
    Establish and return a connection to PostgreSQL using PG* env vars or DATABASE_URL.
    """
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        conn = psycopg2.connect(database_url)
        logger.info("Connected to PostgreSQL via DATABASE_URL")
        return conn

    db_host = os.getenv("PGHOST")
    db_password = os.getenv("PGPASSWORD")
    db_port = os.getenv("PGPORT", "5432")
    db_name = os.getenv("PGDATABASE", "xsell")
    db_user = os.getenv("PGUSER")
    sslmode = os.getenv("PGSSLMODE", "prefer")

    if not all([db_host, db_password, db_user]):
        error_msg = (
            "Missing database credentials. Set DATABASE_URL or PGHOST, PGUSER, and PGPASSWORD."
        )
        logger.error(error_msg)
        raise ValueError(error_msg)

    try:
        conn = psycopg2.connect(
            host=db_host,
            database=db_name,
            user=db_user,
            password=db_password,
            port=db_port,
            sslmode=sslmode,
        )
        logger.info("Connected to PostgreSQL database %s as user %s", db_name, db_user)
        return conn
    except psycopg2.OperationalError as exc:
        logger.error("Unable to connect to database: %s", exc)
        raise


def get_xsell_connection():
    """PostgreSQL connection for xsell app data (dict rows like sqlite3.Row)."""
    conn = get_postgres_connection()
    conn.cursor_factory = RealDictCursor
    return conn


def _get_conn():
    """Alias used by xsell_helpers."""
    return get_xsell_connection()


def is_unique_violation(exc: BaseException) -> bool:
    return isinstance(exc, pg_errors.UniqueViolation)


def is_undefined_table(exc: BaseException) -> bool:
    return isinstance(exc, pg_errors.UndefinedTable)


@contextmanager
def xsell_cursor(*, commit: bool = False) -> Iterator[Any]:
    conn = get_xsell_connection()
    cur = conn.cursor()
    try:
        yield cur
        if commit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()
