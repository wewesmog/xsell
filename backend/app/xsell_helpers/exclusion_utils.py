"""Shared exclusion helpers (PostgreSQL lists + Oracle lookback)."""

from __future__ import annotations

from app.shared_services.db import get_xsell_connection as _get_conn


def exclusion_msisdns_from_lists(list_ids: list[str]) -> set[str]:
    """Distinct normalized MSISDNs from one or more approved exclusion lists."""
    if not list_ids:
        return set()
    conn = _get_conn()
    try:
        placeholders = ",".join("%s" for _ in list_ids)
        cur = conn.cursor()
        cur.execute(
            f"""
            SELECT DISTINCT msisdn_clean
            FROM list_rows
            WHERE list_id IN ({placeholders})
              AND is_valid = TRUE AND decision = 'keep' AND msisdn_clean != ''
            """,
            list_ids,
        )
        rows = cur.fetchall()
        return {str(r["msisdn_clean"]) for r in rows}
    finally:
        conn.close()
