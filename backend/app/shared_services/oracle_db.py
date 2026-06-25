"""
Central Oracle database access for xsell (lookups, exclusions, etc.).

Configure via environment variables (see backend/.env.example):
  ORACLE_USER, ORACLE_PASSWORD, ORACLE_HOST, ORACLE_PORT, ORACLE_SERVICE

Usage:
    from app.shared_services.oracle_db import OracleConnection, get_oracle_connection

    with OracleConnection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM DUAL")
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Iterator

from dotenv import load_dotenv

load_dotenv()


def oracle_configured() -> bool:
    """True when all required ORACLE_* env vars are set."""
    return all(
        [
            os.getenv("ORACLE_USER", "").strip(),
            os.getenv("ORACLE_PASSWORD", "").strip(),
            os.getenv("ORACLE_HOST", "").strip(),
            os.getenv("ORACLE_SERVICE", "").strip(),
        ]
    )


def _oracle_credentials() -> dict[str, str | int]:
    user = os.getenv("ORACLE_USER", "").strip()
    password = os.getenv("ORACLE_PASSWORD", "").strip()
    host = os.getenv("ORACLE_HOST", "").strip()
    service = os.getenv("ORACLE_SERVICE", "").strip()
    port = int(os.getenv("ORACLE_PORT", "1521"))
    if not all([user, password, host, service]):
        raise ValueError(
            "Missing Oracle credentials. Set ORACLE_USER, ORACLE_PASSWORD, "
            "ORACLE_HOST, ORACLE_SERVICE in environment."
        )
    return {
        "user": user,
        "password": password,
        "host": host,
        "port": port,
        "service_name": service,
    }


def get_oracle_connection():
    """Return a new oracledb connection (thin mode). Caller must close."""
    import oracledb

    creds = _oracle_credentials()
    return oracledb.connect(
        user=creds["user"],
        password=creds["password"],
        host=creds["host"],
        port=creds["port"],
        service_name=creds["service_name"],
    )


def get_oracle_sqlalchemy_engine():
    """SQLAlchemy engine for Oracle (pandas read_sql, etc.)."""
    from sqlalchemy import create_engine

    creds = _oracle_credentials()
    url = (
        f"oracle+oracledb://{creds['user']}:{creds['password']}"
        f"@{creds['host']}:{creds['port']}/?service_name={creds['service_name']}"
    )
    return create_engine(url)


class OracleConnection:
    """Context manager — same pattern as legacy Deck/db.py."""

    def __init__(self) -> None:
        self.conn = None

    def __enter__(self):
        self.conn = get_oracle_connection()
        return self.conn

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if self.conn:
            self.conn.close()
            self.conn = None


@contextmanager
def oracle_cursor() -> Iterator:
    """Shortcut: with oracle_cursor() as cur: ..."""
    with OracleConnection() as conn:
        cur = conn.cursor()
        try:
            yield cur
            conn.commit()
        except Exception:
            conn.rollback()
            raise
