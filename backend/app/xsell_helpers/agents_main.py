"""Agents and roster absences CRUD."""

from __future__ import annotations

from uuid import uuid4

import sqlite3

from app.xsell_helpers.canon_main import _get_conn


def _row_to_agent(row: sqlite3.Row, absent_dates: list[str] | None = None) -> dict:
    data = dict(row)
    data["active"] = bool(data.get("active", 1))
    data["absent_dates"] = sorted(absent_dates or [])
    return data


def _load_absent_dates(conn: sqlite3.Connection, staff_nos: list[str]) -> dict[str, list[str]]:
    if not staff_nos:
        return {}
    placeholders = ",".join("?" for _ in staff_nos)
    rows = conn.execute(
        f"""
        SELECT staff_no, absent_date
        FROM roster_absences
        WHERE staff_no IN ({placeholders})
        ORDER BY absent_date
        """,
        staff_nos,
    ).fetchall()
    out: dict[str, list[str]] = {s: [] for s in staff_nos}
    for row in rows:
        out.setdefault(row["staff_no"], []).append(row["absent_date"])
    return out


def list_agents(*, active_only: bool = False) -> list[dict]:
    conn = _get_conn()
    try:
        query = "SELECT staff_no, staff_name, active, created_at, updated_at FROM agents"
        if active_only:
            query += " WHERE active = 1"
        query += " ORDER BY staff_name COLLATE NOCASE"
        rows = conn.execute(query).fetchall()
        staff_nos = [r["staff_no"] for r in rows]
        absences = _load_absent_dates(conn, staff_nos)
        return [_row_to_agent(r, absences.get(r["staff_no"], [])) for r in rows]
    except sqlite3.OperationalError as exc:
        if "no such table" in str(exc).lower():
            raise ValueError(
                "Agents table not found. Run: python scripts/apply_migration.py"
            ) from exc
        raise
    finally:
        conn.close()


def get_agent(staff_no: str) -> dict | None:
    conn = _get_conn()
    try:
        row = conn.execute(
            """
            SELECT staff_no, staff_name, active, created_at, updated_at
            FROM agents WHERE staff_no = ?
            """,
            (staff_no.strip(),),
        ).fetchone()
        if not row:
            return None
        absences = _load_absent_dates(conn, [staff_no])
        return _row_to_agent(row, absences.get(staff_no, []))
    finally:
        conn.close()


def create_agent(*, staff_no: str, staff_name: str, active: bool = True) -> dict:
    code = staff_no.strip().upper()
    name = staff_name.strip()
    if not code:
        raise ValueError("Staff number is required")
    if not name:
        raise ValueError("Staff name is required")

    conn = _get_conn()
    try:
        conn.execute(
            """
            INSERT INTO agents (staff_no, staff_name, active)
            VALUES (?, ?, ?)
            """,
            (code, name, 1 if active else 0),
        )
        conn.commit()
        created = get_agent(code)
        if not created:
            raise ValueError("Failed to create agent")
        return created
    except sqlite3.IntegrityError as exc:
        if "unique" in str(exc).lower() or "primary" in str(exc).lower():
            raise ValueError("Staff number already exists") from exc
        raise ValueError("Failed to create agent") from exc
    finally:
        conn.close()


def update_agent(
    staff_no: str,
    *,
    staff_name: str | None = None,
    active: bool | None = None,
) -> dict:
    existing = get_agent(staff_no)
    if not existing:
        raise ValueError("Agent not found")

    fields: list[str] = []
    params: list[object] = []
    if staff_name is not None:
        name = staff_name.strip()
        if not name:
            raise ValueError("Staff name is required")
        fields.append("staff_name = ?")
        params.append(name)
    if active is not None:
        fields.append("active = ?")
        params.append(1 if active else 0)
    if not fields:
        return existing

    params.append(staff_no.strip())
    conn = _get_conn()
    try:
        conn.execute(
            f"UPDATE agents SET {', '.join(fields)} WHERE staff_no = ?",
            params,
        )
        conn.commit()
        updated = get_agent(staff_no)
        if not updated:
            raise ValueError("Failed to update agent")
        return updated
    finally:
        conn.close()


def delete_agent(staff_no: str) -> None:
    conn = _get_conn()
    try:
        cur = conn.execute("DELETE FROM agents WHERE staff_no = ?", (staff_no.strip(),))
        conn.commit()
        if cur.rowcount == 0:
            raise ValueError("Agent not found")
    finally:
        conn.close()


def list_absences(*, from_date: str | None = None, to_date: str | None = None) -> list[dict]:
    conn = _get_conn()
    try:
        query = """
            SELECT
                r.absence_id,
                r.staff_no,
                a.staff_name,
                r.absent_date,
                r.note,
                r.created_at
            FROM roster_absences r
            JOIN agents a ON a.staff_no = r.staff_no
        """
        params: list[str] = []
        clauses: list[str] = []
        if from_date:
            clauses.append("r.absent_date >= ?")
            params.append(from_date)
        if to_date:
            clauses.append("r.absent_date <= ?")
            params.append(to_date)
        if clauses:
            query += " WHERE " + " AND ".join(clauses)
        query += " ORDER BY r.absent_date, a.staff_name"
        return [dict(r) for r in conn.execute(query, params).fetchall()]
    finally:
        conn.close()


def create_absence(*, staff_no: str, absent_date: str, note: str = "") -> dict:
    code = staff_no.strip().upper()
    date = absent_date.strip()
    if not get_agent(code):
        raise ValueError("Agent not found")

    absence_id = str(uuid4())
    conn = _get_conn()
    try:
        conn.execute(
            """
            INSERT INTO roster_absences (absence_id, staff_no, absent_date, note)
            VALUES (?, ?, ?, ?)
            """,
            (absence_id, code, date, note.strip()),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT r.absence_id, r.staff_no, a.staff_name, r.absent_date, r.note, r.created_at
            FROM roster_absences r
            JOIN agents a ON a.staff_no = r.staff_no
            WHERE r.absence_id = ?
            """,
            (absence_id,),
        ).fetchone()
        if not row:
            raise ValueError("Failed to create absence")
        return dict(row)
    except sqlite3.IntegrityError as exc:
        if "unique" in str(exc).lower():
            raise ValueError("Absence already recorded for this agent and date") from exc
        raise ValueError("Failed to create absence") from exc
    finally:
        conn.close()


def delete_absence(absence_id: str) -> None:
    conn = _get_conn()
    try:
        cur = conn.execute(
            "DELETE FROM roster_absences WHERE absence_id = ?",
            (absence_id,),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise ValueError("Absence not found")
    finally:
        conn.close()


def agents_by_staff_no() -> dict[str, dict]:
    """Map staff_no -> agent dict for generation."""
    return {a["staff_no"]: a for a in list_agents()}


def list_roster(*, active_only: bool = True, from_date: str | None = None, to_date: str | None = None) -> list[dict]:
    """Agents with absent_dates for schedule UI and capacity checks.

    When from_date/to_date are set, only absences in that window are attached
    (still returns all agents; absent_dates may be a subset).
    """
    agents = list_agents(active_only=active_only)
    if not from_date and not to_date:
        return agents

    conn = _get_conn()
    try:
        query = "SELECT staff_no, absent_date FROM roster_absences WHERE 1=1"
        params: list[str] = []
        if from_date:
            query += " AND absent_date >= ?"
            params.append(from_date)
        if to_date:
            query += " AND absent_date <= ?"
            params.append(to_date)
        rows = conn.execute(query, params).fetchall()
        by_staff: dict[str, list[str]] = {}
        for row in rows:
            by_staff.setdefault(row["staff_no"], []).append(row["absent_date"])
        for agent in agents:
            agent["absent_dates"] = sorted(by_staff.get(agent["staff_no"], []))
        return agents
    finally:
        conn.close()
