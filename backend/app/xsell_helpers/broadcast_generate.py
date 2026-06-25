"""Generate per-agent/day Excel workbooks from a saved broadcast config."""

from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from app.xsell_helpers.agents_main import agents_by_staff_no
from app.xsell_helpers.broadcast_main import _resolve_schedule_dates, get_broadcast
from app.shared_services.db import get_xsell_connection as _get_conn
from app.xsell_helpers.workbook_columns import (
    MANDATORY_DROPDOWNS,
    build_workbook_column_order,
    build_workbook_schema_snapshot,
    normalize_custom_fields,
)
from app.xsell_helpers.broadcast_response_main import (
    seed_responses_from_assignment,
)
from app.xsell_helpers.oracle_exclusions import build_excluded_msisdns

BASE_DIR = Path(__file__).resolve().parents[2]
OUTPUTS_DIR = BASE_DIR / "data" / "outputs"
RANDOM_SEED = 42


def _sanitize_folder_name(name: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*]', "_", str(name or "").strip())
    return cleaned or "unnamed"


def _format_display_date(iso: str) -> str:
    try:
        return datetime.strptime(iso, "%Y-%m-%d").strftime("%d-%b-%Y")
    except ValueError:
        return iso


def _display_label_map(leads: dict) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for item in leads.get("columnRenames") or []:
        src = str(item.get("sourceHeader", "")).strip()
        label = str(item.get("displayLabel", "")).strip()
        if src and label:
            mapping[src] = label
    return mapping


def _export_columns(config: dict, label_map: dict[str, str]) -> list[str]:
    ranking = config.get("ranking") or {}
    visible = list(ranking.get("agentVisibleColumns") or [])
    if not visible:
        msisdn_col = str((config.get("leads") or {}).get("msisdnColumn") or "")
        if msisdn_col:
            visible = [label_map.get(msisdn_col, msisdn_col)]
    return visible


def _load_list_rows(list_id: str) -> pd.DataFrame:
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT msisdn_clean, customer_name, others_json
            FROM list_rows
            WHERE list_id = %s AND is_valid = TRUE AND decision = 'keep'
            """,
            (list_id,),
        )
        rows = cur.fetchall()
    finally:
        conn.close()

    records: list[dict[str, Any]] = []
    for row in rows:
        raw_others = row["others_json"]
        if isinstance(raw_others, dict):
            others = raw_others
        else:
            others = json.loads(raw_others or "{}")
        record = {str(k): v for k, v in others.items()}
        record["_msisdn_clean"] = row["msisdn_clean"]
        record["_customer_name"] = row["customer_name"] or ""
        records.append(record)
    return pd.DataFrame(records)


def _to_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(
        series.astype(str).str.replace(",", "", regex=False),
        errors="coerce",
    )


def _winsorize(series: pd.Series, mode: str) -> pd.Series:
    if mode != "p5-p95":
        return series
    valid = series.dropna()
    if valid.empty:
        return series
    lo, hi = valid.quantile(0.05), valid.quantile(0.95)
    return series.clip(lower=lo, upper=hi)


def _rank_pool(df: pd.DataFrame, config: dict) -> pd.DataFrame:
    ranking = config.get("ranking") or {}
    if ranking.get("enabled") is False:
        out = df.copy()
        out["_rank_score"] = 0.0
        return out

    criteria = ranking.get("criteria") or []
    winsorize = str(ranking.get("winsorize") or "none")
    if df.empty or not criteria:
        out = df.copy()
        out["_rank_score"] = 0.0
        return out

    scores = pd.Series(0.0, index=df.index, dtype=float)
    for crit in criteria:
        col = str(crit.get("column") or "")
        if col not in df.columns:
            continue
        weight = float(crit.get("weight") or 0) / 100.0
        direction = str(crit.get("direction") or "higher")
        values = _winsorize(_to_numeric(df[col]), winsorize)
        valid = values.dropna()
        if valid.empty:
            continue
        vmin, vmax = valid.min(), valid.max()
        if vmax == vmin:
            norm = pd.Series(0.5, index=df.index, dtype=float)
        else:
            norm = (values - vmin) / (vmax - vmin)
        if direction == "lower":
            norm = 1.0 - norm
        scores = scores.add(norm.fillna(0.0) * weight, fill_value=0.0)

    out = df.copy()
    out["_rank_score"] = scores
    return out.sort_values("_rank_score", ascending=False).reset_index(drop=True)


def _eligible_staff_for_date(
    staff_nos: list[str], agents_map: dict[str, dict], iso_date: str
) -> list[str]:
    eligible: list[str] = []
    for staff_no in staff_nos:
        agent = agents_map.get(staff_no)
        if not agent or not agent.get("active", True):
            continue
        if iso_date in (agent.get("absent_dates") or []):
            continue
        eligible.append(staff_no)
    return eligible


def _build_schedule_slots(
    config: dict, agents_map: dict[str, dict]
) -> list[dict[str, str]]:
    schedule = config.get("schedule") or {}
    agents_cfg = config.get("agents") or {}
    staff_nos = list(agents_cfg.get("selectedStaffNos") or [])
    dates = _resolve_schedule_dates(schedule)
    slots: list[dict[str, str]] = []
    for iso_date in dates:
        for staff_no in _eligible_staff_for_date(staff_nos, agents_map, iso_date):
            agent = agents_map.get(staff_no, {})
            slots.append(
                {
                    "group_id": str(len(slots)),
                    "staff_no": staff_no,
                    "agent_name": str(agent.get("staff_name") or staff_no),
                    "assigned_date": iso_date,
                    "assigned_date_display": _format_display_date(iso_date),
                }
            )
    return slots


def _group_capacity(n_groups: int, n_rows: int) -> np.ndarray:
    if n_groups <= 0:
        return np.array([], dtype=int)
    base, rem = divmod(n_rows, n_groups)
    return np.array([base + (1 if gid < rem else 0) for gid in range(n_groups)], dtype=int)


def _assignment_capacity(n_groups: int, per_day: int, sample_n: int) -> np.ndarray:
    """Per agent-day targets: full quota when pool allows, else even split of sample_n."""
    needed = n_groups * per_day
    if sample_n >= needed:
        return np.full(n_groups, per_day, dtype=int)
    return _group_capacity(n_groups, sample_n)


def _phone_key_series(series: pd.Series) -> pd.Series:
    return series.astype(str).str.replace(r"\D", "", regex=False).str[-9:]


def _dedupe_ranked_pool(ranked: pd.DataFrame) -> pd.DataFrame:
    if ranked.empty or "_msisdn_clean" not in ranked.columns:
        return ranked
    if not ranked["_msisdn_clean"].duplicated().any():
        return ranked
    return ranked.drop_duplicates(subset=["_msisdn_clean"], keep="first").reset_index(drop=True)


def _top_up_groups(
    assigned: pd.DataFrame,
    reserve: pd.DataFrame,
    capacity: np.ndarray,
) -> pd.DataFrame:
    """Fill short agent-day groups from reserve pool (notebook top_up_groups)."""
    if assigned.empty or reserve.empty or "_msisdn_clean" not in assigned.columns:
        return assigned

    out = assigned.copy()
    used = set(_phone_key_series(out["_msisdn_clean"]).tolist())
    reserve = reserve.loc[~_phone_key_series(reserve["_msisdn_clean"]).isin(used)].copy()
    reserve_idx = 0

    for gid in range(len(capacity)):
        have = int((out["group_id"] == gid).sum())
        need = int(capacity[gid]) - have
        while need > 0 and reserve_idx < len(reserve):
            row = reserve.iloc[reserve_idx : reserve_idx + 1].copy()
            reserve_idx += 1
            phone = _phone_key_series(row["_msisdn_clean"]).iloc[0]
            if phone in used:
                continue
            row["group_id"] = gid
            out = pd.concat([out, row], ignore_index=True)
            used.add(phone)
            need -= 1

    return out


def _safety_purge_and_top_up(
    assigned: pd.DataFrame,
    reserve: pd.DataFrame,
    capacity: np.ndarray,
) -> pd.DataFrame:
    """Remove duplicate phones after assign, then back-fill short groups from reserve."""
    if assigned.empty or "_msisdn_clean" not in assigned.columns:
        return assigned

    out = assigned.copy()
    out["_assign_phone"] = _phone_key_series(out["_msisdn_clean"])
    if out["_assign_phone"].duplicated().any():
        out = (
            out.sort_values("group_id")
            .drop_duplicates(subset=["_assign_phone"], keep="first")
            .reset_index(drop=True)
        )
    out = out.drop(columns=["_assign_phone"])

    out = _top_up_groups(out, reserve, capacity)
    short = any(
        int(capacity[gid]) > int((out["group_id"] == gid).sum()) for gid in range(len(capacity))
    )
    if short:
        out = _top_up_groups(out, reserve, capacity)
    return out


def _greedy_assign_by_column(
    pool_df: pd.DataFrame, capacity: np.ndarray, fairness_col: str
) -> pd.DataFrame:
    n_groups = len(capacity)
    cap = capacity.copy()
    group_sum = np.zeros(n_groups, dtype=float)
    assigned: list[int] = []
    values = _to_numeric(pool_df[fairness_col]).fillna(0.0).to_numpy()
    for value in values:
        candidates = np.flatnonzero(cap > 0)
        if len(candidates) == 0:
            break
        gid = int(candidates[np.argmin(group_sum[candidates])])
        assigned.append(gid)
        cap[gid] -= 1
        group_sum[gid] += float(value)
    out = pool_df.iloc[: len(assigned)].copy()
    out["group_id"] = assigned
    return out


def _sample_even_buckets(pool_df: pd.DataFrame, n_rows: int, fairness_col: str) -> pd.DataFrame:
    values = _to_numeric(pool_df[fairness_col]).fillna(0.0)
    ranked = pool_df.copy()
    ranked["_fair_val"] = values
    ranked = ranked.sort_values("_fair_val").reset_index(drop=True)
    if ranked.empty:
        return ranked
    n = min(n_rows, len(ranked))
    thirds = max(1, n // 3)
    low, mid, high = ranked.iloc[:thirds], ranked.iloc[thirds : 2 * thirds], ranked.iloc[2 * thirds :]
    parts = [low, mid, high]
    picked: list[pd.DataFrame] = []
    idx = 0
    while sum(len(p) for p in picked) < n:
        part = parts[idx % len(parts)]
        remaining = n - sum(len(p) for p in picked)
        if len(part) == 0:
            idx += 1
            if idx > len(parts) * 2:
                break
            continue
        take = min(len(part), max(1, remaining // max(1, len(parts) - (idx % len(parts)))))
        picked.append(part.iloc[:take])
        parts[idx % len(parts)] = part.iloc[take:]
        idx += 1
    if not picked:
        return ranked.iloc[:n].copy()
    return pd.concat(picked, ignore_index=True).iloc[:n].copy()


def _assign_pool(
    ranked: pd.DataFrame,
    *,
    config: dict,
    slots: list[dict[str, str]],
    per_day: int,
) -> pd.DataFrame:
    assignment = config.get("assignment") or {}
    mode = str(assignment.get("mode") or "random")
    fairness_col = str(assignment.get("fairnessColumn") or "")
    n_groups = len(slots)
    if ranked.empty or n_groups == 0:
        return pd.DataFrame()

    needed = n_groups * per_day
    sample_n = min(len(ranked), needed)
    pool = ranked.iloc[:sample_n].copy()
    capacity = _assignment_capacity(n_groups, per_day, sample_n)

    if mode in ("fair", "fair_even"):
        if not fairness_col:
            raise ValueError("fairnessColumn is required for fair assignment modes")
        if fairness_col not in pool.columns:
            raise ValueError(f"Fairness column '{fairness_col}' not found in lead list")

    if mode == "random":
        pool = pool.sample(frac=1, random_state=RANDOM_SEED).reset_index(drop=True)
        pool["group_id"] = np.arange(len(pool)) % n_groups
        counts: dict[int, int] = {}
        keep_idx: list[int] = []
        for i, gid in enumerate(pool["group_id"].tolist()):
            gid = int(gid)
            counts[gid] = counts.get(gid, 0) + 1
            if counts[gid] <= capacity[gid]:
                keep_idx.append(i)
        pool = pool.iloc[keep_idx].copy()
    elif mode == "fair_even":
        pool = _sample_even_buckets(pool, sample_n, fairness_col)
        pool = pool.sample(frac=1, random_state=RANDOM_SEED).reset_index(drop=True)
        pool = _greedy_assign_by_column(pool, capacity, fairness_col)
    else:
        pool = _greedy_assign_by_column(pool, capacity, fairness_col)
        pool = pool.sample(frac=1, random_state=RANDOM_SEED).reset_index(drop=True)

    mapping = pd.DataFrame(slots)
    mapping["group_id"] = mapping["group_id"].astype(int)
    pool["group_id"] = pool["group_id"].astype(int)
    return pool.merge(mapping, on="group_id", how="inner").reset_index(drop=True)


def _rename_for_export(df: pd.DataFrame, label_map: dict[str, str]) -> pd.DataFrame:
    rename = {src: label for src, label in label_map.items() if src in df.columns}
    return df.rename(columns=rename)


def _write_workbook(
    batch: pd.DataFrame,
    *,
    file_path: Path,
    export_cols: list[str],
    custom_fields: list[dict[str, Any]],
    product_name: str,
    agent_name: str,
    staff_no: str,
    date_display: str,
    today_str: str,
) -> None:
    file_path.parent.mkdir(parents=True, exist_ok=True)
    batch = batch.copy()
    batch["Date"] = date_display
    batch["Product Name"] = product_name
    batch["Agent Name"] = agent_name

    ordered = build_workbook_column_order(export_cols, custom_fields)
    custom_by_label = {f["label"]: f for f in custom_fields}

    for col in ordered:
        if col in batch.columns:
            continue
        if col == "Lead ID":
            continue
        batch[col] = ""

    start_row = 5
    sheet_name = date_display[:31]

    with pd.ExcelWriter(file_path, engine="xlsxwriter") as writer:
        batch[ordered].to_excel(writer, sheet_name=sheet_name, index=False, startrow=start_row)
        workbook = writer.book
        worksheet = writer.sheets[sheet_name]
        header_fmt = workbook.add_format(
            {
                "bold": True,
                "bg_color": "#1F4E78",
                "font_color": "white",
                "border": 1,
                "align": "center",
            }
        )
        kpi_val_fmt = workbook.add_format(
            {"bold": True, "border": 1, "align": "center", "bg_color": "#D9E1F2"}
        )
        border_fmt = workbook.add_format({"border": 1, "align": "left"})
        msisdn_fmt = workbook.add_format(
            {"bg_color": "#FDEDF6", "border": 1, "align": "left", "num_format": "@"}
        )

        num_rows = len(batch)
        if num_rows == 0:
            return

        for col_idx, col_name in enumerate(ordered):
            worksheet.write(start_row, col_idx, col_name, header_fmt)

        data_start = start_row + 1
        data_end = start_row + num_rows
        worksheet.write(0, 0, "TOTAL LEADS", header_fmt)
        worksheet.write_formula(
            1,
            0,
            f"=COUNTA(A{data_start + 1}:A{data_end + 1})",
            kpi_val_fmt,
        )

        mobile_col = "Mobile Number"
        for r_idx in range(num_rows):
            row_idx = data_start + r_idx
            for col_idx, col_name in enumerate(ordered):
                if col_name == "Lead ID":
                    value = f"{today_str}_{staff_no}_{r_idx + 1:02d}"
                    worksheet.write(row_idx, col_idx, value, border_fmt)
                elif col_name == mobile_col:
                    worksheet.write(row_idx, col_idx, batch.iloc[r_idx].get(col_name, ""), msisdn_fmt)
                else:
                    worksheet.write(row_idx, col_idx, batch.iloc[r_idx].get(col_name, ""), border_fmt)

        for col_idx, col_name in enumerate(ordered):
            if col_name in MANDATORY_DROPDOWNS:
                worksheet.data_validation(
                    data_start,
                    col_idx,
                    data_end,
                    col_idx,
                    {"validate": "list", "source": MANDATORY_DROPDOWNS[col_name]},
                )
                continue
            custom = custom_by_label.get(col_name)
            if not custom:
                continue
            field_type = custom.get("fieldType", "text")
            if field_type == "dropdown" and custom.get("options"):
                worksheet.data_validation(
                    data_start,
                    col_idx,
                    data_end,
                    col_idx,
                    {"validate": "list", "source": custom["options"]},
                )
            elif field_type == "number":
                worksheet.data_validation(
                    data_start,
                    col_idx,
                    data_end,
                    col_idx,
                    {"validate": "decimal", "criteria": ">=", "value": 0},
                )
            elif field_type == "date":
                worksheet.data_validation(
                    data_start,
                    col_idx,
                    data_end,
                    col_idx,
                    {"validate": "date", "criteria": "between", "minimum": "2020-01-01", "maximum": "2099-12-31"},
                )


def generate_broadcast_files(broadcast_id: str) -> dict[str, Any]:
    row = get_broadcast(broadcast_id)
    if not row:
        raise ValueError("Broadcast not found")

    config = row.get("config_json") or {}
    leads = config.get("leads") or {}
    volume = config.get("volume") or {}
    list_id = (leads.get("fileName") or row.get("lead_list_id") or "").strip()
    if not list_id:
        raise ValueError("Broadcast has no lead list")

    agents_map = agents_by_staff_no()
    slots = _build_schedule_slots(config, agents_map)
    if not slots:
        raise ValueError("No agent-day slots (check agents and schedule dates)")

    per_day = int(volume.get("leadsPerAgentPerDay") or 0)
    if per_day < 1:
        raise ValueError("leadsPerAgentPerDay must be at least 1")

    label_map = _display_label_map(leads)
    export_cols = _export_columns(config, label_map)

    df = _load_list_rows(list_id)
    if df.empty:
        raise ValueError("Lead list has no rows")

    exclusion_ids = [
        str(item.get("listId"))
        for item in (leads.get("exclusionLists") or [])
        if item.get("listId")
    ]
    if leads.get("exclusionsEnabled"):
        lookback = int(leads.get("exclusionsLookbackDays") or 60)
        product_names = [
            str(name).strip()
            for name in (leads.get("exclusionProductNames") or [])
            if str(name).strip()
        ]
        excluded = build_excluded_msisdns(
            exclusions_enabled=True,
            lookback_days=lookback,
            exclusion_list_ids=exclusion_ids,
            exclusion_product_names=product_names or None,
            use_cache=False,
        )
        if excluded:
            df = df[~df["_msisdn_clean"].isin(excluded)].reset_index(drop=True)

    available = len(df)
    pool_size = int(leads.get("poolSize") or available)
    pool_size = min(pool_size, available)
    ranked = _rank_pool(df, config)
    ranked = _dedupe_ranked_pool(ranked)
    if pool_size > 0:
        ranked = ranked.iloc[:pool_size].copy()

    n_groups = len(slots)
    needed = n_groups * per_day
    sample_n = min(len(ranked), needed)
    capacity = _assignment_capacity(n_groups, per_day, sample_n)

    assigned = _assign_pool(ranked, config=config, slots=slots, per_day=per_day)
    if assigned.empty:
        raise ValueError("No leads assigned — check pool size and capacity")

    used_phones = set(_phone_key_series(assigned["_msisdn_clean"]))
    reserve = ranked.loc[~_phone_key_series(ranked["_msisdn_clean"]).isin(used_phones)].copy()
    assigned = _safety_purge_and_top_up(assigned, reserve, capacity)
    if assigned.empty:
        raise ValueError("No leads assigned after safety purge — check pool size and capacity")

    msisdn_src = str(leads.get("msisdnColumn") or "")
    name_src = str(leads.get("nameColumn") or "")
    if msisdn_src and msisdn_src in assigned.columns:
        assigned[label_map.get(msisdn_src, "Mobile Number")] = assigned[msisdn_src]
    elif "_msisdn_clean" in assigned.columns:
        assigned["Mobile Number"] = assigned["_msisdn_clean"]
    if name_src and name_src in assigned.columns:
        assigned[label_map.get(name_src, "Customer Name")] = assigned[name_src]
    elif "_customer_name" in assigned.columns:
        assigned["Customer Name"] = assigned["_customer_name"]

    export_df = _rename_for_export(assigned, label_map)
    for col in export_cols:
        if col not in export_df.columns and col in assigned.columns:
            export_df[col] = assigned[col]

    broadcast_name = _sanitize_folder_name(row.get("broadcast_name") or broadcast_id)
    campaign_name = _sanitize_folder_name(row.get("campaign_name") or "campaign")
    run_dir = OUTPUTS_DIR / broadcast_id / f"{campaign_name}_{broadcast_name}"
    run_dir.mkdir(parents=True, exist_ok=True)

    product_name = str(
        (config.get("campaign") or {}).get("campaignName")
        or row.get("campaign_name")
        or "Campaign"
    ).strip()
    custom_fields = normalize_custom_fields(volume.get("customFields"))
    today_str = datetime.now().strftime("%d%b%Y")
    files_written: list[str] = []

    for staff_no in sorted({s["staff_no"] for s in slots}):
        agent_name = next(s["agent_name"] for s in slots if s["staff_no"] == staff_no)
        agent_dir = run_dir / _sanitize_folder_name(agent_name)
        agent_data = assigned[assigned["staff_no"] == staff_no]
        for slot in [s for s in slots if s["staff_no"] == staff_no]:
            iso_date = slot["assigned_date"]
            date_display = slot["assigned_date_display"]
            batch = agent_data[agent_data["assigned_date"] == iso_date]
            if batch.empty:
                continue
            file_name = f"{_sanitize_folder_name(agent_name)}_Details_{date_display}.xlsx"
            file_path = agent_dir / file_name
            _write_workbook(
                export_df.loc[batch.index],
                file_path=file_path,
                export_cols=export_cols,
                custom_fields=custom_fields,
                product_name=product_name,
                agent_name=agent_name,
                staff_no=staff_no,
                date_display=date_display,
                today_str=today_str,
            )
            files_written.append(str(file_path.relative_to(BASE_DIR)))

    workbook_cols = build_workbook_column_order(export_cols, custom_fields)
    master_path = run_dir / "MASTER_ASSIGNMENT_LOG.xlsx"
    log_cols = ["assigned_date", "staff_no", "agent_name", *[c for c in workbook_cols if c not in ("Date", "Lead ID")]]
    log_df = assigned.copy()
    log_df["assigned_date"] = log_df["assigned_date_display"]
    log_df[[c for c in log_cols if c in log_df.columns]].to_excel(master_path, index=False)
    files_written.append(str(master_path.relative_to(BASE_DIR)))

    generated_at = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    output_dir = str(run_dir.relative_to(BASE_DIR))

    workbook_schema = build_workbook_schema_snapshot(
        export_cols,
        custom_fields,
        generated_at=generated_at,
    )

    seed_rows: list[dict[str, Any]] = []
    data_cols = [c for c in workbook_cols if c not in ("Date", "Lead ID", "Product Name", "Agent Name")]
    for _, row in assigned.iterrows():
        seed_rows.append(
            {
                "staff_no": row.get("staff_no"),
                "assigned_date": row.get("assigned_date"),
                "Mobile Number": row.get("Mobile Number") or row.get("_msisdn_clean"),
                **{col: row.get(col, "") for col in data_cols if col in row.index},
            }
        )
    responses_seeded = seed_responses_from_assignment(
        broadcast_id,
        seed_rows,
        lead_columns=[c for c in export_cols if c in workbook_cols],
    )

    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE broadcasts
            SET generated_at = %s, output_dir = %s, workbook_schema_json = %s
            WHERE broadcast_id = %s
            """,
            (generated_at, output_dir, json.dumps(workbook_schema), broadcast_id),
        )
        conn.commit()
    finally:
        conn.close()

    return {
        "broadcast_id": broadcast_id,
        "output_dir": output_dir,
        "generated_at": generated_at,
        "files_written": files_written,
        "rows_assigned": len(assigned),
        "agent_day_slots": len(slots),
        "responses_seeded": responses_seeded,
        "workbook_schema": workbook_schema,
    }
