"""Broadcast (schedule run) CRUD — config holds full wizard draft for later generate_files."""

from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

import psycopg2

from app.shared_services.db import get_xsell_connection as _get_conn
from app.shared_services.db import is_unique_violation, is_undefined_table


def _resolve_schedule_dates(schedule: dict) -> list[str]:
    mode = schedule.get("mode")
    if mode == "specific":
        dates = schedule.get("specificDates") or []
        return sorted(str(d) for d in dates)
    start = schedule.get("startDate")
    num_days = schedule.get("numDays")
    if not start or not num_days:
        return []
    from datetime import date, timedelta

    start_d = date.fromisoformat(str(start))
    return [(start_d + timedelta(days=i)).isoformat() for i in range(int(num_days))]


def _extract_from_config(config: dict) -> tuple[str | None, int, list[str]]:
    leads = config.get("leads") or {}
    schedule = config.get("schedule") or {}
    list_id = (leads.get("fileName") or "").strip() or None
    pool_size = int(leads.get("poolSize") or 0)
    dates = _resolve_schedule_dates(schedule)
    return list_id, pool_size, dates


def _parse_json_field(value: Any, default: Any) -> Any:
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return default


def _row_to_broadcast(row: dict, *, include_config: bool = False) -> dict:
    data = dict(row)
    data["schedule_dates"] = _parse_json_field(data.get("schedule_dates"), [])
    if include_config:
        data["config_json"] = _parse_json_field(data.get("config_json"), {})
    else:
        data.pop("config_json", None)
    return data


def create_broadcast(
    *,
    campaign_id: str,
    broadcast_name: str,
    config_json: dict,
    created_by: str = "frontend-user",
) -> dict:
    name = broadcast_name.strip()
    if not name:
        raise ValueError("Broadcast name is required")
    if not campaign_id:
        raise ValueError("Campaign is required")

    list_id, pool_size, dates = _extract_from_config(config_json)
    broadcast_id = str(uuid4())
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT campaign_id FROM campaigns WHERE campaign_id = %s",
            (campaign_id,),
        )
        parent = cur.fetchone()
        if not parent:
            raise ValueError("Campaign not found")

        cur.execute(
            """
            INSERT INTO broadcasts (
                broadcast_id, campaign_id, broadcast_name, lead_list_id,
                pool_size, schedule_dates, config_json, created_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                broadcast_id,
                campaign_id,
                name,
                list_id,
                pool_size,
                json.dumps(dates),
                json.dumps(config_json),
                created_by.strip() or "frontend-user",
            ),
        )
        conn.commit()
        cur.execute(
            """
            SELECT b.*, c.campaign_name
            FROM broadcasts b
            JOIN campaigns c ON c.campaign_id = b.campaign_id
            WHERE b.broadcast_id = %s
            """,
            (broadcast_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("Failed to create broadcast")
        return _row_to_broadcast(row, include_config=True)
    except psycopg2.IntegrityError as exc:
        conn.rollback()
        if is_unique_violation(exc):
            raise ValueError("Broadcast name already exists for this campaign") from exc
        raise ValueError("Failed to create broadcast") from exc
    finally:
        conn.close()


def list_broadcasts(*, campaign_id: str | None = None) -> list[dict]:
    conn = _get_conn()
    try:
        cur = conn.cursor()
        if campaign_id:
            cur.execute(
                """
                SELECT b.*, c.campaign_name
                FROM broadcasts b
                JOIN campaigns c ON c.campaign_id = b.campaign_id
                WHERE b.campaign_id = %s
                ORDER BY b.created_at DESC
                """,
                (campaign_id,),
            )
        else:
            cur.execute(
                """
                SELECT b.*, c.campaign_name
                FROM broadcasts b
                JOIN campaigns c ON c.campaign_id = b.campaign_id
                ORDER BY b.created_at DESC
                """
            )
        rows = cur.fetchall()
        return [_row_to_broadcast(r) for r in rows]
    except psycopg2.Error as exc:
        if is_undefined_table(exc):
            raise ValueError(
                "Broadcasts table not found. Run: python scripts/apply_migration.py"
            ) from exc
        raise
    finally:
        conn.close()


def get_broadcast(broadcast_id: str) -> dict | None:
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT b.*, c.campaign_name
            FROM broadcasts b
            JOIN campaigns c ON c.campaign_id = b.campaign_id
            WHERE b.broadcast_id = %s
            """,
            (broadcast_id,),
        )
        row = cur.fetchone()
        return _row_to_broadcast(row, include_config=True) if row else None
    finally:
        conn.close()


def update_broadcast(
    broadcast_id: str,
    *,
    broadcast_name: str | None = None,
    campaign_id: str | None = None,
    config_json: dict | None = None,
    status: str | None = None,
) -> dict:
    existing = get_broadcast(broadcast_id)
    if not existing:
        raise ValueError("Broadcast not found")

    fields: list[str] = []
    params: list[object] = []

    if broadcast_name is not None:
        name = broadcast_name.strip()
        if not name:
            raise ValueError("Broadcast name is required")
        fields.append("broadcast_name = %s")
        params.append(name)

    if campaign_id is not None:
        fields.append("campaign_id = %s")
        params.append(campaign_id)

    if status is not None:
        if status not in ("active", "inactive"):
            raise ValueError("Status must be active or inactive")
        fields.append("status = %s")
        params.append(status)

    if config_json is not None:
        list_id, pool_size, dates = _extract_from_config(config_json)
        fields.extend(
            [
                "config_json = %s",
                "lead_list_id = %s",
                "pool_size = %s",
                "schedule_dates = %s",
            ]
        )
        params.extend(
            [json.dumps(config_json), list_id, pool_size, json.dumps(dates)]
        )

    if not fields:
        return existing

    params.append(broadcast_id)
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE broadcasts SET {', '.join(fields)} WHERE broadcast_id = %s",
            params,
        )
        conn.commit()
        updated = get_broadcast(broadcast_id)
        if not updated:
            raise ValueError("Failed to update broadcast")
        return updated
    except psycopg2.IntegrityError as exc:
        conn.rollback()
        if is_unique_violation(exc):
            raise ValueError("Broadcast name already exists for this campaign") from exc
        raise
    finally:
        conn.close()


def delete_broadcast(broadcast_id: str) -> None:
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM broadcasts WHERE broadcast_id = %s",
            (broadcast_id,),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise ValueError("Broadcast not found")
    finally:
        conn.close()


def _unique_copy_name(campaign_id: str, base_name: str) -> str:
    candidate = f"{base_name}_copy"
    conn = _get_conn()
    try:
        cur = conn.cursor()
        n = 2
        while True:
            cur.execute(
                """
                SELECT 1 FROM broadcasts
                WHERE campaign_id = %s AND LOWER(broadcast_name) = LOWER(%s)
                """,
                (campaign_id, candidate),
            )
            if not cur.fetchone():
                return candidate
            candidate = f"{base_name}_copy{n}"
            n += 1
    finally:
        conn.close()


def duplicate_broadcast(broadcast_id: str, *, created_by: str = "frontend-user") -> dict:
    """Clone broadcast config with a _copy name for editing in the schedule wizard."""
    source = get_broadcast(broadcast_id)
    if not source:
        raise ValueError("Broadcast not found")

    config = json.loads(json.dumps(source.get("config_json") or {}))
    campaign = config.get("campaign") or {}
    campaign["broadcastId"] = ""
    base_name = str(source.get("broadcast_name") or "broadcast").strip()
    copy_name = _unique_copy_name(source["campaign_id"], base_name)
    campaign["broadcastName"] = copy_name
    config["campaign"] = campaign

    return create_broadcast(
        campaign_id=source["campaign_id"],
        broadcast_name=copy_name,
        config_json=config,
        created_by=created_by,
    )
