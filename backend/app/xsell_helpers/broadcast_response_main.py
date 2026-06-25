"""Upsert agent workbook responses — variable columns via JSON."""

from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

import psycopg2

from app.shared_services.db import get_xsell_connection as _get_conn
from app.shared_services.db import is_undefined_table
from app.xsell_helpers.broadcast_main import get_broadcast
from app.xsell_helpers.canon_main import _normalize_msisdn


def _parse_json_obj(raw: str | dict | None) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    try:
        obj = json.loads(raw or "{}")
        return obj if isinstance(obj, dict) else {}
    except json.JSONDecodeError:
        return {}


def _row_to_response(row: dict) -> dict[str, Any]:
    data = dict(row)
    data["assignment_json"] = _parse_json_obj(data.get("assignment_json"))
    data["responses_json"] = _parse_json_obj(data.get("responses_json"))
    return data


def get_workbook_schema(broadcast_id: str) -> dict[str, Any] | None:
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT workbook_schema_json FROM broadcasts WHERE broadcast_id = %s",
            (broadcast_id,),
        )
        row = cur.fetchone()
        if not row or not row["workbook_schema_json"]:
            return None
        schema = _parse_json_obj(row["workbook_schema_json"])
        return schema if schema else None
    finally:
        conn.close()


def list_responses(
    broadcast_id: str,
    *,
    staff_no: str | None = None,
    assigned_date: str | None = None,
) -> list[dict]:
    if not get_broadcast(broadcast_id):
        raise ValueError("Broadcast not found")

    query = """
        SELECT *
        FROM broadcast_responses
        WHERE broadcast_id = %s
    """
    params: list[str] = [broadcast_id]
    if staff_no:
        query += " AND staff_no = %s"
        params.append(staff_no.strip().upper())
    if assigned_date:
        query += " AND assigned_date = %s"
        params.append(assigned_date.strip())
    query += " ORDER BY assigned_date, staff_no, msisdn_clean"

    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(query, params)
        rows = cur.fetchall()
        return [_row_to_response(r) for r in rows]
    except psycopg2.Error as exc:
        if is_undefined_table(exc):
            raise ValueError(
                "broadcast_responses table not found. Run: python scripts/apply_migration.py"
            ) from exc
        raise
    finally:
        conn.close()


def _merge_responses(existing: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    merged = {**existing}
    for key, value in incoming.items():
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        merged[key] = value
    return merged


def upsert_response(
    broadcast_id: str,
    *,
    staff_no: str,
    assigned_date: str,
    msisdn: str,
    lead_id: str | None = None,
    responses: dict[str, Any] | None = None,
    assignment: dict[str, Any] | None = None,
) -> dict:
    if not get_broadcast(broadcast_id):
        raise ValueError("Broadcast not found")

    code = staff_no.strip().upper()
    date = assigned_date.strip()
    msisdn_clean = _normalize_msisdn(msisdn)
    if not code or not date:
        raise ValueError("staff_no and assigned_date are required")
    if not msisdn_clean:
        raise ValueError("Valid msisdn is required")

    schema = get_workbook_schema(broadcast_id)
    if schema and responses:
        allowed = set(schema.get("editable_keys") or [])
        unknown = [k for k in responses if k not in allowed]
        if unknown:
            raise ValueError(f"Unknown response fields for this broadcast: {', '.join(unknown)}")

    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT response_id, assignment_json, responses_json
            FROM broadcast_responses
            WHERE broadcast_id = %s AND staff_no = %s AND assigned_date = %s AND msisdn_clean = %s
            """,
            (broadcast_id, code, date, msisdn_clean),
        )
        existing = cur.fetchone()

        if existing:
            merged_assignment = _merge_responses(
                _parse_json_obj(existing["assignment_json"]),
                assignment or {},
            )
            merged_responses = _merge_responses(
                _parse_json_obj(existing["responses_json"]),
                responses or {},
            )
            cur.execute(
                """
                UPDATE broadcast_responses
                SET lead_id = COALESCE(%s, lead_id),
                    assignment_json = %s,
                    responses_json = %s
                WHERE response_id = %s
                """,
                (
                    lead_id,
                    json.dumps(merged_assignment),
                    json.dumps(merged_responses),
                    existing["response_id"],
                ),
            )
            conn.commit()
            response_id = existing["response_id"]
        else:
            response_id = str(uuid4())
            cur.execute(
                """
                INSERT INTO broadcast_responses (
                    response_id, broadcast_id, staff_no, assigned_date,
                    msisdn_clean, lead_id, assignment_json, responses_json
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    response_id,
                    broadcast_id,
                    code,
                    date,
                    msisdn_clean,
                    lead_id,
                    json.dumps(assignment or {}),
                    json.dumps(responses or {}),
                ),
            )
            conn.commit()

        cur.execute(
            "SELECT * FROM broadcast_responses WHERE response_id = %s",
            (response_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("Failed to save response")
        return _row_to_response(row)
    finally:
        conn.close()


def upsert_responses_batch(
    broadcast_id: str,
    items: list[dict[str, Any]],
) -> dict[str, Any]:
    saved: list[dict] = []
    errors: list[dict[str, str]] = []
    for idx, item in enumerate(items):
        try:
            row = upsert_response(
                broadcast_id,
                staff_no=str(item.get("staff_no") or ""),
                assigned_date=str(item.get("assigned_date") or ""),
                msisdn=str(item.get("msisdn") or item.get("msisdn_clean") or ""),
                lead_id=(str(item["lead_id"]) if item.get("lead_id") else None),
                responses=item.get("responses") or item.get("fields") or {},
                assignment=item.get("assignment") or {},
            )
            saved.append(row)
        except ValueError as exc:
            errors.append({"index": str(idx), "error": str(exc)})
    return {"saved": saved, "saved_count": len(saved), "errors": errors}


def seed_responses_from_assignment(
    broadcast_id: str,
    assigned_rows: list[dict[str, Any]],
    *,
    lead_columns: list[str],
) -> int:
    """Create empty response rows when workbooks are generated (idempotent upsert)."""
    count = 0
    for row in assigned_rows:
        msisdn = row.get("Mobile Number") or row.get("_msisdn_clean") or ""
        assignment = {col: row.get(col, "") for col in lead_columns if col in row}
        try:
            upsert_response(
                broadcast_id,
                staff_no=str(row.get("staff_no") or ""),
                assigned_date=str(row.get("assigned_date") or ""),
                msisdn=str(msisdn),
                lead_id=str(row.get("lead_id") or "") or None,
                responses={},
                assignment=assignment,
            )
            count += 1
        except ValueError:
            continue
    return count


def save_workbook_schema(broadcast_id: str, schema: dict[str, Any]) -> None:
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE broadcasts SET workbook_schema_json = %s WHERE broadcast_id = %s",
            (json.dumps(schema), broadcast_id),
        )
        conn.commit()
    finally:
        conn.close()
