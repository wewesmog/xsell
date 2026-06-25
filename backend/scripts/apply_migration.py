"""Apply pending SQL migrations in backend/migrations/ to backend/xsell.db."""

from pathlib import Path

import sqlite3

BASE_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BASE_DIR / "xsell.db"
MIGRATIONS_DIR = BASE_DIR / "migrations"


def _ensure_migrations_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            filename TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """
    )


def _is_applied(conn: sqlite3.Connection, filename: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM schema_migrations WHERE filename = ?",
        (filename,),
    ).fetchone()
    return row is not None


def _mark_applied(conn: sqlite3.Connection, filename: str) -> None:
    conn.execute(
        "INSERT INTO schema_migrations (filename) VALUES (?)",
        (filename,),
    )


def _bootstrap_legacy_migrations(conn: sqlite3.Connection) -> None:
    """If lists already exist from a prior manual 001 run, don't re-apply it."""
    lists = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='lists'"
    ).fetchone()
    if lists and not _is_applied(conn, "001_list_ingestion_schema.sql"):
        _mark_applied(conn, "001_list_ingestion_schema.sql")
        print("Marked 001_list_ingestion_schema.sql as applied (lists table already exists)")


def main() -> None:
    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not files:
        raise SystemExit(f"No migrations found in {MIGRATIONS_DIR}")

    conn = sqlite3.connect(DB_PATH)
    try:
        _ensure_migrations_table(conn)
        _bootstrap_legacy_migrations(conn)
        applied_any = False
        for migration in files:
            if _is_applied(conn, migration.name):
                print(f"Skip {migration.name} (already applied)")
                continue
            sql = migration.read_text(encoding="utf-8")
            conn.executescript(sql)
            _mark_applied(conn, migration.name)
            applied_any = True
            print(f"Applied {migration.name}")
        conn.commit()
        if not applied_any:
            print("No pending migrations.")
        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
        print(f"Database: {DB_PATH}")
        print("Tables:", [t[0] for t in tables])
    finally:
        conn.close()


if __name__ == "__main__":
    main()
