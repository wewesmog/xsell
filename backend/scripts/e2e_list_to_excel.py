"""
End-to-end: upload list file → clean → approve → schedule broadcast → generate Excel workbooks.

Primary generate API (same logic as this script):
  POST http://localhost:8000/api/broadcasts/{broadcast_id}/generate

Usage (from backend/, with venv active):
  python scripts/apply_migration.py
  python scripts/e2e_list_to_excel.py --file path/to/leads.csv --msisdn-col MOBILE_NO

Optional: start API separately (uvicorn app.main:app) and use the UI instead.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.xsell_helpers.broadcast_generate import generate_broadcast_files  # noqa: E402
from app.xsell_helpers.broadcast_main import create_broadcast  # noqa: E402
from app.xsell_helpers.campaign_main import create_campaign  # noqa: E402
from app.xsell_helpers.canon_main import (  # noqa: E402
    UPLOADS_DIR,
    _write_staging_meta,
    approve_list,
    clean_list,
)
from app.xsell_helpers.file_ingest import (  # noqa: E402
    extension_for_filename,
    is_supported_upload,
    read_tabular_file,
    normalize_dataframe,
)


def _guess_msisdn_column(headers: list[str]) -> str:
    upper = {h.upper(): h for h in headers}
    for key in ("MSISDN", "MOBILE_NUMBER", "MOBILE_NO", "MOBILE", "PHONE", "TELEPHONE"):
        if key in upper:
            return upper[key]
    return headers[0] if headers else ""


def _guess_rank_column(headers: list[str], df: pd.DataFrame, msisdn_col: str) -> str:
    upper = {h.upper(): h for h in headers}
    for key in ("CREDITLIMIT", "CREDIT_LIMIT", "DPD", "SCORE", "AMOUNT", "LIMIT"):
        col = upper.get(key)
        if col and col != msisdn_col:
            return col
    for col in headers:
        if col == msisdn_col:
            continue
        numeric = pd.to_numeric(
            df[col].astype(str).str.replace(",", "", regex=False),
            errors="coerce",
        )
        if numeric.notna().sum() >= max(1, len(df) // 2):
            return col
    return next((h for h in headers if h != msisdn_col), headers[0] if headers else "")


def ingest_file(
    file_path: Path,
    *,
    list_name: str,
    msisdn_col: str | None,
    uploaded_by: str,
) -> tuple[str, int, list[str], str]:
    if not file_path.exists():
        raise SystemExit(f"File not found: {file_path}")
    if not is_supported_upload(file_path.name):
        raise SystemExit(f"Unsupported file type: {file_path.suffix}")

    list_id = str(uuid4())
    ext = extension_for_filename(file_path.name) or ".csv"
    stored = UPLOADS_DIR / f"{list_id}{ext}"
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    stored.write_bytes(file_path.read_bytes())

    df = normalize_dataframe(read_tabular_file(stored, original_name=file_path.name))
    if df.empty:
        raise SystemExit("File has no data rows")
    headers = list(df.columns)
    msisdn = msisdn_col or _guess_msisdn_column(headers)
    if msisdn not in headers:
        raise SystemExit(f"MSISDN column '{msisdn}' not in headers: {headers}")

    mapping = {
        "msisdnColumn": msisdn,
        "nameColumn": "",
        "columnRenames": [
            {
                "sourceHeader": msisdn,
                "displayLabel": "Mobile Number",
                "includeInExport": True,
            },
            *[
                {"sourceHeader": h, "displayLabel": h, "includeInExport": h != msisdn}
                for h in headers
                if h != msisdn
            ],
        ],
    }
    mapping_json = json.dumps(mapping)
    mapping_path = UPLOADS_DIR / f"{list_id}.mapping.json"
    mapping_path.write_text(mapping_json, encoding="utf-8")
    _write_staging_meta(
        list_id,
        list_name=list_name,
        uploaded_by=uploaded_by,
        file_name=file_path.name,
    )

    print(f"1. Staged list {list_id} ({len(df)} rows in file)")
    stats = clean_list(list_id, list_name=list_name, mapping_json=mapping_json)
    print(
        f"2. Cleaned: raw={stats['raw_count']} clean={stats['clean_count']} "
        f"dup={stats['duplicate_count']}"
    )
    approved = approve_list(list_id, list_name=list_name)
    clean_count = int(approved["clean_count"])
    print(f"3. Approved: status={approved['status']} clean={clean_count}")
    return list_id, clean_count, headers, msisdn


def build_minimal_broadcast_config(
    *,
    list_id: str,
    list_name: str,
    headers: list[str],
    msisdn_col: str,
    rank_col: str,
    pool_size: int,
    staff_nos: list[str],
    exclusions_enabled: bool,
) -> dict:
    return {
        "campaign": {
            "campaignId": "",
            "campaignName": "",
            "broadcastId": "",
            "broadcastName": "E2E test run",
        },
        "leads": {
            "fileName": list_id,
            "listName": list_name,
            "headers": headers,
            "previewRows": [],
            "rowCount": pool_size,
            "msisdnColumn": msisdn_col,
            "nameColumn": "",
            "columnRenames": [
                {
                    "sourceHeader": msisdn_col,
                    "displayLabel": "Mobile Number",
                    "includeInExport": True,
                },
                *[
                    {"sourceHeader": h, "displayLabel": h, "includeInExport": h != msisdn_col}
                    for h in headers
                    if h != msisdn_col
                ],
            ],
            "exclusionsEnabled": exclusions_enabled,
            "exclusionsLookbackDays": 60,
            "exclusionProductNames": [],
            "exclusionLists": [],
            "poolSize": pool_size,
            "excludedCount": 0,
        },
        "ranking": {
            "criteria": [{"column": rank_col, "direction": "higher", "weight": 100}],
            "winsorize": "none",
            "agentVisibleColumns": ["Mobile Number"],
            "includeManagerColumns": True,
        },
        "assignment": {"mode": "random", "fairnessColumn": ""},
        "agents": {"selectedStaffNos": staff_nos, "useFirstN": False, "firstN": 25, "search": ""},
        "volume": {
            "leadsPerAgentPerDay": 10,
            "internalName": "",
            "customFields": [],
        },
        "schedule": {
            "mode": "range",
            "startDate": "2026-06-01",
            "numDays": 1,
            "specificDates": [],
        },
        "review": {"acknowledgeWarnings": True},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="E2E list → Excel workbook generation")
    parser.add_argument("--file", required=True, help="Lead file (csv, tsv, txt, xlsx, xls)")
    parser.add_argument("--list-name", default="E2E list")
    parser.add_argument("--msisdn-col", default=None, help="Source MSISDN column name")
    parser.add_argument("--staff-no", action="append", default=[], help="Agent staff no (repeatable)")
    parser.add_argument("--pool-size", type=int, default=0, help="Cap pool size (0 = auto, max 50)")
    parser.add_argument(
        "--exclusions",
        action="store_true",
        help="Enable Oracle exclusions (requires ORACLE_* in .env)",
    )
    parser.add_argument(
        "--apply-migrations",
        action="store_true",
        help="Run scripts/apply_migration.py before the pipeline",
    )
    args = parser.parse_args()

    if args.apply_migrations:
        subprocess.run([sys.executable, str(BASE_DIR / "scripts" / "apply_migration.py")], check=True)

    file_path = Path(args.file)
    if not file_path.is_absolute():
        file_path = (Path.cwd() / file_path).resolve()

    df = normalize_dataframe(read_tabular_file(file_path, original_name=file_path.name))
    headers = list(df.columns)
    msisdn_col = args.msisdn_col or _guess_msisdn_column(headers)
    rank_col = _guess_rank_column(headers, df, msisdn_col)

    list_id, clean_count, headers, msisdn_col = ingest_file(
        file_path,
        list_name=args.list_name,
        msisdn_col=msisdn_col,
        uploaded_by="e2e-script",
    )

    from app.xsell_helpers.agents_main import list_agents

    agents = list_agents(active_only=True)
    staff_nos = args.staff_no or [a["staff_no"] for a in agents[:2]]
    if not staff_nos:
        raise SystemExit("No agents in DB. Run migrations (005) or pass --staff-no")

    auto_pool = min(50, max(1, clean_count))
    pool_size = min(args.pool_size, clean_count) if args.pool_size > 0 else auto_pool

    campaign = create_campaign(campaign_name="E2E Campaign", description="Script generated")
    config = build_minimal_broadcast_config(
        list_id=list_id,
        list_name=args.list_name,
        headers=headers,
        msisdn_col=msisdn_col,
        rank_col=rank_col,
        pool_size=pool_size,
        staff_nos=staff_nos,
        exclusions_enabled=args.exclusions,
    )
    config["campaign"]["campaignId"] = campaign["campaign_id"]
    config["campaign"]["campaignName"] = campaign["campaign_name"]

    broadcast = create_broadcast(
        campaign_id=campaign["campaign_id"],
        broadcast_name="E2E broadcast",
        config_json=config,
        created_by="e2e-script",
    )
    broadcast_id = broadcast["broadcast_id"]
    print(f"4. Broadcast saved: {broadcast_id}")

    result = generate_broadcast_files(broadcast_id)
    print(f"5. Generated {result['rows_assigned']} rows → {result['output_dir']}")
    for path in result["files_written"][:10]:
        print(f"   - {path}")
    if len(result["files_written"]) > 10:
        print(f"   ... and {len(result['files_written']) - 10} more")


if __name__ == "__main__":
    main()
