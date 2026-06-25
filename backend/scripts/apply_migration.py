"""Apply pending SQL migrations in backend/migrations/ to PostgreSQL."""

from __future__ import annotations

import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.shared_services.db import get_xsell_connection  # noqa: E402

MIGRATIONS_DIR = BASE_DIR / "migrations"


def _strip_leading_sql_comments(statement: str) -> str:
    """Remove leading blank/comment lines so header comments don't skip real SQL."""
    lines: list[str] = []
    for line in statement.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("--"):
            continue
        lines.append(line)
    return "\n".join(lines).strip()


def _split_sql_statements(sql: str) -> list[str]:
    """Split SQL script into executable statements (handles $$ plpgsql blocks)."""
    statements: list[str] = []
    current: list[str] = []
    in_dollar = False

    for line in sql.splitlines():
        if "$$" in line:
            count = line.count("$$")
            if count % 2 == 1:
                in_dollar = not in_dollar

        current.append(line)
        if not in_dollar and line.rstrip().endswith(";"):
            statement = _strip_leading_sql_comments("\n".join(current))
            if statement:
                statements.append(statement)
            current = []

    trailing = _strip_leading_sql_comments("\n".join(current))
    if trailing:
        statements.append(trailing)
    return statements


def _ensure_migrations_table(cur) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            filename TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )


def _is_applied(cur, filename: str) -> bool:
    cur.execute(
        "SELECT 1 FROM schema_migrations WHERE filename = %s",
        (filename,),
    )
    return cur.fetchone() is not None


def _mark_applied(cur, filename: str) -> None:
    cur.execute(
        "INSERT INTO schema_migrations (filename) VALUES (%s)",
        (filename,),
    )


def _run_sql_script(cur, sql: str) -> None:
    for statement in _split_sql_statements(sql):
        cur.execute(statement)


def main() -> None:
    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not files:
        raise SystemExit(f"No migrations found in {MIGRATIONS_DIR}")

    conn = get_xsell_connection()
    try:
        cur = conn.cursor()
        _ensure_migrations_table(cur)
        conn.commit()

        applied_any = False
        for migration in files:
            if _is_applied(cur, migration.name):
                print(f"Skip {migration.name} (already applied)")
                continue
            sql = migration.read_text(encoding="utf-8")
            try:
                _run_sql_script(cur, sql)
                _mark_applied(cur, migration.name)
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            applied_any = True
            print(f"Applied {migration.name}")

        if not applied_any:
            print("No pending migrations.")

        cur.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name
            """
        )
        tables = [row["table_name"] for row in cur.fetchall()]
        db_name = conn.get_dsn_parameters().get("dbname", "postgres")
        print(f"Database: {db_name}")
        print("Tables:", tables)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
