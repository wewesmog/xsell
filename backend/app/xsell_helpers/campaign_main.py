"""Campaign CRUD against PostgreSQL."""

from __future__ import annotations

from uuid import uuid4

import psycopg2

from app.shared_services.db import get_xsell_connection as _get_conn
from app.shared_services.db import is_unique_violation, is_undefined_table

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
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO campaigns (campaign_id, campaign_name, description, created_by, status)
            VALUES (%s, %s, %s, %s, 'active')
            """,
            (campaign_id, name, description.strip(), created_by.strip() or "frontend-user"),
        )
        conn.commit()
        cur.execute(
            f"{_CAMPAIGN_SELECT} WHERE c.campaign_id = %s",
            (campaign_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("Failed to create campaign")
        return dict(row)
    except psycopg2.IntegrityError as exc:
        conn.rollback()
        if is_unique_violation(exc):
            raise ValueError("Campaign name already exists") from exc
        raise ValueError("Failed to create campaign") from exc
    finally:
        conn.close()


def list_campaigns() -> list[dict]:
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(f"{_CAMPAIGN_SELECT} ORDER BY c.created_at DESC")
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    except psycopg2.Error as exc:
        if is_undefined_table(exc):
            raise ValueError(
                "Campaigns table not found. Run: python scripts/apply_migration.py"
            ) from exc
        raise
    finally:
        conn.close()


def get_campaign(campaign_id: str) -> dict | None:
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            f"{_CAMPAIGN_SELECT} WHERE c.campaign_id = %s",
            (campaign_id,),
        )
        row = cur.fetchone()
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
        fields.append("campaign_name = %s")
        params.append(name)

    if description is not None:
        fields.append("description = %s")
        params.append(description.strip())

    if status is not None:
        if status not in ("active", "inactive"):
            raise ValueError("Status must be active or inactive")
        fields.append("status = %s")
        params.append(status)

    if not fields:
        return existing

    params.append(campaign_id)
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE campaigns SET {', '.join(fields)} WHERE campaign_id = %s",
            params,
        )
        conn.commit()
        updated = get_campaign(campaign_id)
        if not updated:
            raise ValueError("Failed to update campaign")
        return updated
    except psycopg2.IntegrityError as exc:
        conn.rollback()
        if is_unique_violation(exc):
            raise ValueError("Campaign name already exists") from exc
        raise
    finally:
        conn.close()


def delete_campaign(campaign_id: str) -> None:
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM campaigns WHERE campaign_id = %s",
            (campaign_id,),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise ValueError("Campaign not found")
    finally:
        conn.close()
