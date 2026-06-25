"""Agents and roster absences CRUD."""

from __future__ import annotations

from uuid import uuid4

import psycopg2

from app.shared_services.db import get_xsell_connection as _get_conn
from app.shared_services.db import is_unique_violation, is_undefined_table


def _row_to_agent(row: dict, absent_dates: list[str] | None = None) -> dict:
    data = dict(row)
    data["active"] = bool(data.get("active", True))
    data["absent_dates"] = sorted(absent_dates or [])
    return data


def _load_absent_dates(conn, staff_nos: list[str]) -> dict[str, list[str]]:
    if not staff_nos:
        return {}
    placeholders = ",".join("%s" for _ in staff_nos)
    cur = conn.cursor()
    cur.execute(
        f"""
        SELECT staff_no, absent_date
        FROM roster_absences
        WHERE staff_no IN ({placeholders})
        ORDER BY absent_date
        """,
        staff_nos,
    )
    rows = cur.fetchall()
    out: dict[str, list[str]] = {s: [] for s in staff_nos}
    for row in rows:
        out.setdefault(row["staff_no"], []).append(row["absent_date"])
    return out


def list_agents(*, active_only: bool = False) -> list[dict]:
    conn = _get_conn()
    try:
        query = "SELECT staff_no, staff_name, active, created_at, updated_at FROM agents"
        if active_only:
            query += " WHERE active = TRUE"
        query += " ORDER BY LOWER(staff_name)"
        cur = conn.cursor()
        cur.execute(query)
        rows = cur.fetchall()
        staff_nos = [r["staff_no"] for r in rows]
        absences = _load_absent_dates(conn, staff_nos)
        return [_row_to_agent(r, absences.get(r["staff_no"], [])) for r in rows]
    except psycopg2.Error as exc:
        if is_undefined_table(exc):
            raise ValueError(
                "Agents table not found. Run: python scripts/apply_migration.py"
            ) from exc
        raise
    finally:
        conn.close()


def get_agent(staff_no: str) -> dict | None:
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT staff_no, staff_name, active, created_at, updated_at
            FROM agents WHERE staff_no = %s
            """,
            (staff_no.strip(),),
        )
        row = cur.fetchone()
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
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO agents (staff_no, staff_name, active)
            VALUES (%s, %s, %s)
            """,
            (code, name, active),
        )
        conn.commit()
        created = get_agent(code)
        if not created:
            raise ValueError("Failed to create agent")
        return created
    except psycopg2.IntegrityError as exc:
        conn.rollback()
        if is_unique_violation(exc):
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
        fields.append("staff_name = %s")
        params.append(name)
    if active is not None:
        fields.append("active = %s")
        params.append(active)
    if not fields:
        return existing

    params.append(staff_no.strip())
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE agents SET {', '.join(fields)} WHERE staff_no = %s",
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
        cur = conn.cursor()
        cur.execute("DELETE FROM agents WHERE staff_no = %s", (staff_no.strip(),))
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
            clauses.append("r.absent_date >= %s")
            params.append(from_date)
        if to_date:
            clauses.append("r.absent_date <= %s")
            params.append(to_date)
        if clauses:
            query += " WHERE " + " AND ".join(clauses)
        query += " ORDER BY r.absent_date, a.staff_name"
        cur = conn.cursor()
        cur.execute(query, params)
        return [dict(r) for r in cur.fetchall()]
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
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO roster_absences (absence_id, staff_no, absent_date, note)
            VALUES (%s, %s, %s, %s)
            """,
            (absence_id, code, date, note.strip()),
        )
        conn.commit()
        cur.execute(
            """
            SELECT r.absence_id, r.staff_no, a.staff_name, r.absent_date, r.note, r.created_at
            FROM roster_absences r
            JOIN agents a ON a.staff_no = r.staff_no
            WHERE r.absence_id = %s
            """,
            (absence_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("Failed to create absence")
        return dict(row)
    except psycopg2.IntegrityError as exc:
        conn.rollback()
        if is_unique_violation(exc):
            raise ValueError("Absence already recorded for this agent and date") from exc
        raise ValueError("Failed to create absence") from exc
    finally:
        conn.close()


def delete_absence(absence_id: str) -> None:
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM roster_absences WHERE absence_id = %s",
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
    """Agents with absent_dates for schedule UI and capacity checks."""
    agents = list_agents(active_only=active_only)
    if not from_date and not to_date:
        return agents

    conn = _get_conn()
    try:
        query = "SELECT staff_no, absent_date FROM roster_absences WHERE TRUE"
        params: list[str] = []
        if from_date:
            query += " AND absent_date >= %s"
            params.append(from_date)
        if to_date:
            query += " AND absent_date <= %s"
            params.append(to_date)
        cur = conn.cursor()
        cur.execute(query, params)
        rows = cur.fetchall()
        by_staff: dict[str, list[str]] = {}
        for row in rows:
            by_staff.setdefault(row["staff_no"], []).append(row["absent_date"])
        for agent in agents:
            agent["absent_dates"] = sorted(by_staff.get(agent["staff_no"], []))
        return agents
    finally:
        conn.close()
