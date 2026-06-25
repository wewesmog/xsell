"""Broadcast (schedule run) CRUD — config holds full wizard draft for later generate_files."""

import json
from uuid import uuid4

import sqlite3

from app.xsell_helpers.canon_main import _get_conn


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


def _row_to_broadcast(row: sqlite3.Row, *, include_config: bool = False) -> dict:
    data = dict(row)
    dates_raw = data.get("schedule_dates") or "[]"
    try:
        data["schedule_dates"] = json.loads(dates_raw)
    except json.JSONDecodeError:
        data["schedule_dates"] = []
    if include_config:
        try:
            data["config_json"] = json.loads(data.get("config_json") or "{}")
        except json.JSONDecodeError:
            data["config_json"] = {}
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
        parent = conn.execute(
            "SELECT campaign_id FROM campaigns WHERE campaign_id = ?",
            (campaign_id,),
        ).fetchone()
        if not parent:
            raise ValueError("Campaign not found")

        conn.execute(
            """
            INSERT INTO broadcasts (
                broadcast_id, campaign_id, broadcast_name, lead_list_id,
                pool_size, schedule_dates, config_json, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
        row = conn.execute(
            """
            SELECT b.*, c.campaign_name
            FROM broadcasts b
            JOIN campaigns c ON c.campaign_id = b.campaign_id
            WHERE b.broadcast_id = ?
            """,
            (broadcast_id,),
        ).fetchone()
        if not row:
            raise ValueError("Failed to create broadcast")
        return _row_to_broadcast(row, include_config=True)
    except sqlite3.IntegrityError as exc:
        if "idx_broadcasts_campaign_name" in str(exc).lower() or "unique" in str(exc).lower():
            raise ValueError("Broadcast name already exists for this campaign") from exc
        raise ValueError("Failed to create broadcast") from exc
    finally:
        conn.close()


def list_broadcasts(*, campaign_id: str | None = None) -> list[dict]:
    conn = _get_conn()
    try:
        if campaign_id:
            rows = conn.execute(
                """
                SELECT b.*, c.campaign_name
                FROM broadcasts b
                JOIN campaigns c ON c.campaign_id = b.campaign_id
                WHERE b.campaign_id = ?
                ORDER BY b.created_at DESC
                """,
                (campaign_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT b.*, c.campaign_name
                FROM broadcasts b
                JOIN campaigns c ON c.campaign_id = b.campaign_id
                ORDER BY b.created_at DESC
                """
            ).fetchall()
        return [_row_to_broadcast(r) for r in rows]
    except sqlite3.OperationalError as exc:
        if "no such table" in str(exc).lower():
            raise ValueError(
                "Broadcasts table not found. Run: python scripts/apply_migration.py"
            ) from exc
        raise
    finally:
        conn.close()


def get_broadcast(broadcast_id: str) -> dict | None:
    conn = _get_conn()
    try:
        row = conn.execute(
            """
            SELECT b.*, c.campaign_name
            FROM broadcasts b
            JOIN campaigns c ON c.campaign_id = b.campaign_id
            WHERE b.broadcast_id = ?
            """,
            (broadcast_id,),
        ).fetchone()
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
        fields.append("broadcast_name = ?")
        params.append(name)

    if campaign_id is not None:
        fields.append("campaign_id = ?")
        params.append(campaign_id)

    if status is not None:
        if status not in ("active", "inactive"):
            raise ValueError("Status must be active or inactive")
        fields.append("status = ?")
        params.append(status)

    if config_json is not None:
        list_id, pool_size, dates = _extract_from_config(config_json)
        fields.extend(
            [
                "config_json = ?",
                "lead_list_id = ?",
                "pool_size = ?",
                "schedule_dates = ?",
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
        conn.execute(
            f"UPDATE broadcasts SET {', '.join(fields)} WHERE broadcast_id = ?",
            params,
        )
        conn.commit()
        updated = get_broadcast(broadcast_id)
        if not updated:
            raise ValueError("Failed to update broadcast")
        return updated
    except sqlite3.IntegrityError as exc:
        if "unique" in str(exc).lower():
            raise ValueError("Broadcast name already exists for this campaign") from exc
        raise
    finally:
        conn.close()


def delete_broadcast(broadcast_id: str) -> None:
    conn = _get_conn()
    try:
        cur = conn.execute(
            "DELETE FROM broadcasts WHERE broadcast_id = ?",
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
        n = 2
        while conn.execute(
            """
            SELECT 1 FROM broadcasts
            WHERE campaign_id = ? AND broadcast_name = ? COLLATE NOCASE
            """,
            (campaign_id, candidate),
        ).fetchone():
            candidate = f"{base_name}_copy{n}"
            n += 1
        return candidate
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
