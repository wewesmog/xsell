"""Campaign CRUD against SQLite."""

from uuid import uuid4

import sqlite3

from app.xsell_helpers.canon_main import _get_conn

_CAMPAIGN_SELECT = """
    SELECT
        c.campaign_id,
        c.campaign_name,
        c.description,
        COALESCE(c.status, 'active') AS status,
        c.created_by,
        c.created_at,
        c.updated_at,
        (SELECT COUNT(*) FROM broadcasts b WHERE b.campaign_id = c.campaign_id) AS broadcast_count
    FROM campaigns c
"""


def create_campaign(
    *,
    campaign_name: str,
    description: str = "",
    created_by: str = "frontend-user",
) -> dict:
    name = campaign_name.strip()
    if not name:
        raise ValueError("Campaign name is required")

    campaign_id = str(uuid4())
    conn = _get_conn()
    try:
        conn.execute(
            """
            INSERT INTO campaigns (campaign_id, campaign_name, description, created_by, status)
            VALUES (?, ?, ?, ?, 'active')
            """,
            (campaign_id, name, description.strip(), created_by.strip() or "frontend-user"),
        )
        conn.commit()
        row = conn.execute(
            f"{_CAMPAIGN_SELECT} WHERE c.campaign_id = ?",
            (campaign_id,),
        ).fetchone()
        if not row:
            raise ValueError("Failed to create campaign")
        return dict(row)
    except sqlite3.IntegrityError as exc:
        if "unique" in str(exc).lower():
            raise ValueError("Campaign name already exists") from exc
        raise ValueError("Failed to create campaign") from exc
    finally:
        conn.close()


def list_campaigns() -> list[dict]:
    conn = _get_conn()
    try:
        rows = conn.execute(
            f"{_CAMPAIGN_SELECT} ORDER BY c.created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]
    except sqlite3.OperationalError as exc:
        if "no such table" in str(exc).lower():
            raise ValueError(
                "Campaigns table not found. Run: python scripts/apply_migration.py"
            ) from exc
        raise
    finally:
        conn.close()


def get_campaign(campaign_id: str) -> dict | None:
    conn = _get_conn()
    try:
        row = conn.execute(
            f"{_CAMPAIGN_SELECT} WHERE c.campaign_id = ?",
            (campaign_id,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def update_campaign(
    campaign_id: str,
    *,
    campaign_name: str | None = None,
    description: str | None = None,
    status: str | None = None,
) -> dict:
    existing = get_campaign(campaign_id)
    if not existing:
        raise ValueError("Campaign not found")

    fields: list[str] = []
    params: list[object] = []

    if campaign_name is not None:
        name = campaign_name.strip()
        if not name:
            raise ValueError("Campaign name is required")
        fields.append("campaign_name = ?")
        params.append(name)

    if description is not None:
        fields.append("description = ?")
        params.append(description.strip())

    if status is not None:
        if status not in ("active", "inactive"):
            raise ValueError("Status must be active or inactive")
        fields.append("status = ?")
        params.append(status)

    if not fields:
        return existing

    params.append(campaign_id)
    conn = _get_conn()
    try:
        conn.execute(
            f"UPDATE campaigns SET {', '.join(fields)} WHERE campaign_id = ?",
            params,
        )
        conn.commit()
        updated = get_campaign(campaign_id)
        if not updated:
            raise ValueError("Failed to update campaign")
        return updated
    except sqlite3.IntegrityError as exc:
        if "unique" in str(exc).lower():
            raise ValueError("Campaign name already exists") from exc
        raise
    finally:
        conn.close()


def delete_campaign(campaign_id: str) -> None:
    conn = _get_conn()
    try:
        cur = conn.execute(
            "DELETE FROM campaigns WHERE campaign_id = ?",
            (campaign_id,),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise ValueError("Campaign not found")
    finally:
        conn.close()
