from __future__ import annotations

import json
import logging
from pathlib import Path
from uuid import uuid4

import pandas as pd
import psycopg2
from fastapi import UploadFile

from app.models.list_ingestion_models import (
    ListDbStatus,
    RowDecision,
    StagingStatus,
)
from app.shared_services.db import get_xsell_connection as _get_conn
from app.shared_services.db import is_unique_violation
from app.xsell_helpers.file_ingest import (
    extension_for_filename,
    is_supported_upload,
    normalize_dataframe,
    read_tabular_file,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
_INSERT_BATCH_SIZE = 5_000


def _ensure_paths() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def _insert_list_rows_batched(cur, list_id: str, deduped: pd.DataFrame) -> None:
    insert_sql = """
        INSERT INTO list_rows (
            row_id, list_id, source_row_number, msisdn_clean, customer_name,
            others_json, row_hash, decision
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """
    batch: list[tuple] = []
    for idx, r in deduped.iterrows():
        payload = {k: str(v) for k, v in r.to_dict().items() if not k.startswith("_")}
        batch.append(
            (
                str(uuid4()),
                list_id,
                int(idx) + 2,
                r["_msisdn_clean"],
                r["_customer_name"],
                json.dumps(payload),
                r["_row_hash"],
                RowDecision.keep.value,
            )
        )
        if len(batch) >= _INSERT_BATCH_SIZE:
            cur.executemany(insert_sql, batch)
            batch.clear()
    if batch:
        cur.executemany(insert_sql, batch)


def _normalize_msisdn(value: object) -> str:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if len(digits) < 9:
        return ""
    return f"254{digits[-9:]}"


def _safe_json_load(payload: str | dict | None) -> dict:
    if isinstance(payload, dict):
        return payload
    try:
        obj = json.loads(payload or "{}")
        return obj if isinstance(obj, dict) else {}
    except json.JSONDecodeError:
        return {}


def _read_dataframe(file_path: Path, *, original_name: str | None = None) -> pd.DataFrame:
    df = read_tabular_file(file_path, original_name=original_name)
    return normalize_dataframe(df)


def _dataframe_preview(df: pd.DataFrame, *, limit: int = 50) -> dict:
    headers = [str(c) for c in df.columns]
    preview_rows: list[dict[str, str]] = []
    for _, row in df.head(limit).iterrows():
        preview_rows.append({h: str(row.get(h, "")) for h in headers})
    return {
        "headers": headers,
        "preview_rows": preview_rows,
        "row_count": int(len(df)),
    }


async def preview_list_upload(file: UploadFile, *, preview_limit: int = 50) -> dict:
    """Parse an upload in-memory for column mapping UI (no DB write)."""
    if not file.filename:
        raise ValueError("File name is required")
    if not is_supported_upload(file.filename):
        raise ValueError(
            "Unsupported file type. Use CSV, TSV, TXT, DAT, XLSX, or XLS."
        )

    import tempfile

    suffix = extension_for_filename(file.filename) or ".csv"
    content = await file.read()
    if not content:
        raise ValueError("File is empty")

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        df = _read_dataframe(tmp_path, original_name=file.filename)
    finally:
        tmp_path.unlink(missing_ok=True)

    if df.empty:
        raise ValueError("File has no data rows")

    result = _dataframe_preview(df, limit=preview_limit)
    result["file_name"] = file.filename
    return result


def _remove_upload_artifacts(list_id: str) -> None:
    """Remove staged upload files (data file, mapping, meta)."""
    for path in UPLOADS_DIR.glob(f"{list_id}.*"):
        try:
            path.unlink(missing_ok=True)
        except OSError:
            logger.warning("Could not delete upload artifact: %s", path)


def _meta_path(list_id: str) -> Path:
    return UPLOADS_DIR / f"{list_id}.meta.json"


def _write_staging_meta(
    list_id: str,
    *,
    list_name: str,
    uploaded_by: str,
    file_name: str,
) -> None:
    _meta_path(list_id).write_text(
        json.dumps(
            {
                "list_id": list_id,
                "list_name": list_name,
                "uploaded_by": uploaded_by,
                "file_name": file_name,
            }
        ),
        encoding="utf-8",
    )


def _read_staging_meta(list_id: str) -> dict | None:
    path = _meta_path(list_id)
    if not path.exists():
        return None
    return _safe_json_load(path.read_text(encoding="utf-8"))


def _staging_file_path(list_id: str) -> Path | None:
    candidates = [
        p
        for p in UPLOADS_DIR.glob(f"{list_id}.*")
        if p.suffix.lower() in {".csv", ".tsv", ".txt", ".dat", ".xlsx", ".xls"}
    ]
    return candidates[0] if candidates else None


def _apply_staging_updates(
    list_id: str,
    *,
    list_name: str | None,
    mapping_json: str | None,
) -> tuple[str, str]:
    meta = _read_staging_meta(list_id) or {}
    resolved_name = (list_name or meta.get("list_name", "")).strip()
    uploaded_by = meta.get("uploaded_by", "frontend-user")

    if mapping_json is not None:
        mapping_path = UPLOADS_DIR / f"{list_id}.mapping.json"
        mapping_path.write_text(
            json.dumps(_safe_json_load(mapping_json)),
            encoding="utf-8",
        )

    if resolved_name and meta:
        _write_staging_meta(
            list_id,
            list_name=resolved_name,
            uploaded_by=uploaded_by,
            file_name=meta.get("file_name", ""),
        )

    if not resolved_name:
        raise ValueError("List name is required")

    return resolved_name, uploaded_by


def _clean_stats_payload(
    list_id: str,
    *,
    raw_count: int,
    clean_count: int,
    duplicate_count: int,
    status: str,
) -> dict:
    return {
        "list_id": list_id,
        "status": status,
        "raw_count": raw_count,
        "clean_count": clean_count,
        "duplicate_count": duplicate_count,
    }


async def create_list_upload(
    file: UploadFile,
    list_name: str,
    uploaded_by: str,
    mapping_json: str,
) -> dict:
    _ensure_paths()
    if not file.filename:
        raise ValueError("File name is required")
    if not is_supported_upload(file.filename):
        raise ValueError(
            "Unsupported file type. Use CSV, TSV, TXT, DAT, XLSX, or XLS."
        )

    list_id = str(uuid4())
    suffix = extension_for_filename(file.filename) or ".csv"
    stored_path = UPLOADS_DIR / f"{list_id}{suffix}"
    mapping_path = UPLOADS_DIR / f"{list_id}.mapping.json"
    resolved_name = list_name.strip() or Path(file.filename).stem

    try:
        stored_path.write_bytes(await file.read())
        mapping_obj = _safe_json_load(mapping_json)
        mapping_path.write_text(json.dumps(mapping_obj), encoding="utf-8")
        _write_staging_meta(
            list_id,
            list_name=resolved_name,
            uploaded_by=uploaded_by,
            file_name=file.filename,
        )
    except Exception:
        _remove_upload_artifacts(list_id)
        raise

    return {
        "list_id": list_id,
        "file_name": file.filename,
        "status": StagingStatus.pending.value,
    }


def clean_list(
    list_id: str,
    *,
    list_name: str | None = None,
    mapping_json: str | None = None,
) -> dict:
    """Normalize + dedupe staged file; persist rows with status=processing (not approved yet)."""
    _ensure_paths()
    meta = _read_staging_meta(list_id)
    file_path = _staging_file_path(list_id)
    if not meta and not file_path:
        raise ValueError("Staged upload not found")

    resolved_name, uploaded_by = _apply_staging_updates(
        list_id, list_name=list_name, mapping_json=mapping_json
    )

    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT list_id, status FROM lists WHERE list_id = %s",
            (list_id,),
        )
        existing = cur.fetchone()
        if existing:
            if existing["status"] == ListDbStatus.ready.value:
                raise ValueError("List already approved")
            if existing["status"] == ListDbStatus.archived.value:
                raise ValueError("List is archived")
        else:
            try:
                cur.execute(
                    """
                    INSERT INTO lists (list_id, list_name, uploaded_by, status)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (list_id, resolved_name, uploaded_by, ListDbStatus.processing.value),
                )
                conn.commit()
            except psycopg2.IntegrityError as exc:
                conn.rollback()
                if is_unique_violation(exc):
                    raise ValueError(
                        f"A list named '{resolved_name}' already exists for this user"
                    ) from exc
                raise

        if not file_path:
            raise ValueError("Uploaded file not found")

        mapping_path = UPLOADS_DIR / f"{list_id}.mapping.json"
        mapping = (
            _safe_json_load(mapping_path.read_text(encoding="utf-8"))
            if mapping_path.exists()
            else {}
        )
        msisdn_col = mapping.get("msisdnColumn", "")
        name_col = mapping.get("nameColumn", "")

        meta = _read_staging_meta(list_id)
        original_name = (meta or {}).get("file_name", "") or file_path.name
        df = _read_dataframe(file_path, original_name=original_name)
        raw_count = len(df)
        if raw_count == 0:
            cur.execute(
                """
                UPDATE lists
                SET row_count_raw = 0, row_count_clean = 0, status = %s
                WHERE list_id = %s
                """,
                (ListDbStatus.processing.value, list_id),
            )
            cur.execute("DELETE FROM list_rows WHERE list_id = %s", (list_id,))
            conn.commit()
            return _clean_stats_payload(
                list_id,
                raw_count=0,
                clean_count=0,
                duplicate_count=0,
                status=ListDbStatus.processing.value,
            )

        if msisdn_col not in df.columns:
            msisdn_col = df.columns[0]
        if name_col and name_col not in df.columns:
            name_col = ""

        df["_msisdn_clean"] = df[msisdn_col].map(_normalize_msisdn)
        df = df[df["_msisdn_clean"] != ""].copy()
        if name_col:
            df["_customer_name"] = df[name_col].astype(str).str.strip()
        else:
            df["_customer_name"] = ""

        df["_row_hash"] = pd.util.hash_pandas_object(
            df[[c for c in df.columns if not c.startswith("_")]].astype(str),
            index=False,
        ).astype(str)

        deduped = df.drop_duplicates(subset=["_msisdn_clean"], keep="first").copy()
        clean_count = len(deduped)
        duplicate_count = len(df) - clean_count

        cur.execute("DELETE FROM list_rows WHERE list_id = %s", (list_id,))
        _insert_list_rows_batched(cur, list_id, deduped)

        cur.execute(
            """
            UPDATE lists
            SET list_name = %s, row_count_raw = %s, row_count_clean = %s, status = %s
            WHERE list_id = %s
            """,
            (resolved_name, raw_count, clean_count, ListDbStatus.processing.value, list_id),
        )
        conn.commit()
        return _clean_stats_payload(
            list_id,
            raw_count=raw_count,
            clean_count=clean_count,
            duplicate_count=duplicate_count,
            status=ListDbStatus.processing.value,
        )
    except ValueError:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM lists WHERE list_id = %s AND status = %s",
            (list_id, ListDbStatus.processing.value),
        )
        conn.commit()
        raise
    finally:
        conn.close()


def approve_list(
    list_id: str,
    *,
    list_name: str | None = None,
) -> dict:
    """Approve after user has reviewed clean stats; marks list ready for campaigns."""
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT list_id, list_name, status, row_count_raw, row_count_clean
            FROM lists WHERE list_id = %s
            """,
            (list_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("List not found; run clean first")
        if row["status"] == ListDbStatus.ready.value:
            raw = int(row["row_count_raw"])
            clean = int(row["row_count_clean"])
            return _clean_stats_payload(
                list_id,
                raw_count=raw,
                clean_count=clean,
                duplicate_count=max(raw - clean, 0),
                status=ListDbStatus.ready.value,
            )
        if row["status"] != ListDbStatus.processing.value:
            raise ValueError("List must be cleaned before approval")

        resolved_name = (list_name or row["list_name"]).strip()
        if not resolved_name:
            raise ValueError("List name is required")

        try:
            cur.execute(
                """
                UPDATE lists
                SET list_name = %s, status = %s
                WHERE list_id = %s
                """,
                (resolved_name, ListDbStatus.ready.value, list_id),
            )
            conn.commit()
        except psycopg2.IntegrityError as exc:
            conn.rollback()
            if is_unique_violation(exc):
                raise ValueError(
                    f"A list named '{resolved_name}' already exists for this user"
                ) from exc
            raise

        _meta_path(list_id).unlink(missing_ok=True)
        raw = int(row["row_count_raw"])
        clean = int(row["row_count_clean"])
        return _clean_stats_payload(
            list_id,
            raw_count=raw,
            clean_count=clean,
            duplicate_count=max(raw - clean, 0),
            status=ListDbStatus.ready.value,
        )
    finally:
        conn.close()


def cancel_list_upload(list_id: str) -> dict:
    """Discard staged upload or cleaned-but-unapproved list."""
    _ensure_paths()
    conn = _get_conn()
    row = None
    try:
        cur = conn.cursor()
        try:
            cur.execute(
                "SELECT status FROM lists WHERE list_id = %s",
                (list_id,),
            )
            row = cur.fetchone()
        except psycopg2.Error:
            row = None
        if row:
            if row["status"] == ListDbStatus.ready.value:
                raise ValueError("Cannot cancel an approved list; archive instead")
            cur.execute("DELETE FROM lists WHERE list_id = %s", (list_id,))
            conn.commit()
    finally:
        conn.close()

    if not _read_staging_meta(list_id) and not _staging_file_path(list_id) and not row:
        raise ValueError("Staged upload not found")

    _remove_upload_artifacts(list_id)
    return {"list_id": list_id, "status": StagingStatus.canceled.value}


def get_list_status(list_id: str) -> dict | None:
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT list_id, list_name, uploaded_by, status, row_count_raw, row_count_clean,
                   uploaded_on, updated_on
            FROM lists
            WHERE list_id = %s
            """,
            (list_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        conn.close()


_LIST_SORT_SQL = {
    "newest": "uploaded_on DESC",
    "oldest": "uploaded_on ASC",
    "name_asc": "LOWER(list_name) ASC",
    "name_desc": "LOWER(list_name) DESC",
    "rows_desc": "row_count_clean DESC, uploaded_on DESC",
    "rows_asc": "row_count_clean ASC, uploaded_on DESC",
}


def list_lists(
    *,
    include_archived: bool = False,
    limit: int | None = None,
    search: str | None = None,
    sort: str = "newest",
) -> list[dict]:
    """Approved lists for UI; processing/pending are excluded."""
    if limit is not None and limit < 1:
        raise ValueError("limit must be at least 1")
    if sort not in _LIST_SORT_SQL:
        raise ValueError(f"Invalid sort: {sort}")

    order_sql = _LIST_SORT_SQL[sort]
    limit_sql = f" LIMIT {int(limit)}" if limit is not None else ""

    conn = _get_conn()
    try:
        clauses: list[str] = []
        params: list[object] = []
        if include_archived:
            clauses.append("status IN (%s, %s)")
            params.extend([ListDbStatus.ready.value, ListDbStatus.archived.value])
        else:
            clauses.append("status = %s")
            params.append(ListDbStatus.ready.value)

        if search and search.strip():
            clauses.append("list_name ILIKE %s")
            params.append(f"%{search.strip()}%")

        where_sql = " AND ".join(clauses)
        cur = conn.cursor()
        cur.execute(
            f"""
            SELECT list_id, list_name, uploaded_by, status, row_count_clean, uploaded_on, updated_on
            FROM lists
            WHERE {where_sql}
            ORDER BY {order_sql}
            {limit_sql}
            """,
            params,
        )
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def _is_numeric_value(value: object) -> bool:
    text = str(value or "").strip().replace(",", "")
    if not text:
        return False
    try:
        float(text)
        return True
    except ValueError:
        return False


def _numeric_columns_from_samples(
    headers: list[str],
    rows: list[dict[str, str]],
    *,
    exclude: set[str],
) -> list[str]:
    if not rows:
        return []
    numeric: list[str] = []
    for header in headers:
        if header in exclude:
            continue
        values = [str(row.get(header, "")).strip() for row in rows if str(row.get(header, "")).strip()]
        if not values:
            continue
        if all(_is_numeric_value(value) for value in values):
            numeric.append(header)
    return numeric


def get_list_columns(list_id: str) -> dict | None:
    """Return list column metadata and numeric columns inferred from stored rows."""
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT list_id FROM lists WHERE list_id = %s",
            (list_id,),
        )
        row = cur.fetchone()
        if not row:
            return None

        mapping_path = UPLOADS_DIR / f"{list_id}.mapping.json"
        mapping = (
            _safe_json_load(mapping_path.read_text(encoding="utf-8"))
            if mapping_path.exists()
            else {}
        )
        msisdn_col = str(mapping.get("msisdnColumn", "") or "")
        name_col = str(mapping.get("nameColumn", "") or "")

        cur.execute(
            """
            SELECT others_json
            FROM list_rows
            WHERE list_id = %s AND is_valid = TRUE
            LIMIT 50
            """,
            (list_id,),
        )
        sample_rows_db = cur.fetchall()

        preview_rows: list[dict[str, str]] = []
        header_set: set[str] = set()
        for sample in sample_rows_db:
            others = _safe_json_load(sample["others_json"])
            row_dict = {str(k): str(v) for k, v in others.items()}
            preview_rows.append(row_dict)
            header_set.update(row_dict.keys())

        rename_headers = [
            str(item.get("sourceHeader", ""))
            for item in mapping.get("columnRenames", [])
            if str(item.get("sourceHeader", ""))
        ]
        headers = [h for h in rename_headers if h in header_set]
        headers.extend(sorted(h for h in header_set if h not in headers))

        exclude = {msisdn_col, name_col}
        numeric_columns = _numeric_columns_from_samples(
            headers,
            preview_rows,
            exclude=exclude,
        )

        return {
            "list_id": list_id,
            "headers": headers,
            "numeric_columns": numeric_columns,
            "msisdn_column": msisdn_col,
            "name_column": name_col,
            "preview_rows": preview_rows[:20],
        }
    finally:
        conn.close()


def archive_list(list_id: str) -> dict:
    """Soft-disable a list (status=archived); rows stay in DB; name can be reused."""
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE lists
            SET status = %s, updated_on = NOW()
            WHERE list_id = %s AND status = %s
            """,
            (ListDbStatus.archived.value, list_id, ListDbStatus.ready.value),
        )
        conn.commit()
        if cur.rowcount == 0:
            cur.execute(
                "SELECT list_id, status FROM lists WHERE list_id = %s", (list_id,)
            )
            existing = cur.fetchone()
            if not existing:
                raise ValueError("List not found")
            raise ValueError("Only approved lists can be archived")
        return {"list_id": list_id, "status": ListDbStatus.archived.value}
    finally:
        conn.close()
