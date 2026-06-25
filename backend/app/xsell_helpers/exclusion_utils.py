"""Shared exclusion helpers (SQLite lists + Oracle lookback)."""

from __future__ import annotations

from app.xsell_helpers.canon_main import _get_conn


def exclusion_msisdns_from_lists(list_ids: list[str]) -> set[str]:
    """Distinct normalized MSISDNs from one or more approved exclusion lists."""
    if not list_ids:
        return set()
    conn = _get_conn()
    try:
        placeholders = ",".join("?" for _ in list_ids)
        rows = conn.execute(
            f"""
            SELECT DISTINCT msisdn_clean
            FROM list_rows
            WHERE list_id IN ({placeholders})
              AND is_valid = 1 AND decision = 'keep' AND msisdn_clean != ''
            """,
            list_ids,
        ).fetchall()
        return {str(r["msisdn_clean"]) for r in rows}
    finally:
        conn.close()
