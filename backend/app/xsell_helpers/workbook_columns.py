"""Mandatory workbook column layout (mirrors lending_split / campaign standard)."""

from __future__ import annotations

from typing import Any

# Fixed columns always present on every agent workbook (not from lead list).
MANDATORY_PREFIX: list[str] = [
    "Date",
    "Lead ID",
    "Product Name",
    "Agent Name",
    "Dial Attempt #",
]

MANDATORY_SUFFIX: list[str] = [
    "Connection",
    "Disposition (Outcome)",
    "Outcome comment",
    "Follow-up Action",
    "Follow-up Date",
]

# Lead data columns that must appear if configured in the broadcast.
COMPULSORY_DATA_LABELS: list[str] = ["Mobile Number"]

# Built-in dropdown options for mandatory call-tracker fields.
MANDATORY_DROPDOWNS: dict[str, list[str]] = {
    "Connection": ["Connected", "System Issue", "Unreachable", "Not Answered"],
    "Disposition (Outcome)": [
        "Interested",
        "Not Interested",
        "Voicemail",
        "DND",
        "Call Back",
        "Wrong number",
    ],
}


def build_workbook_column_order(
    export_cols: list[str],
    custom_fields: list[dict[str, Any]] | None = None,
) -> list[str]:
    """Date … data cols … custom agent fields … Connection … Follow-up Date."""
    custom_fields = custom_fields or []
    reserved = set(MANDATORY_PREFIX + MANDATORY_SUFFIX)

    data_cols: list[str] = []
    for label in COMPULSORY_DATA_LABELS:
        if label not in data_cols:
            data_cols.append(label)
    for col in export_cols:
        if col in reserved or col in data_cols:
            continue
        data_cols.append(col)

    custom_labels: list[str] = []
    for field in custom_fields:
        label = str(field.get("label") or "").strip()
        if label and label not in reserved and label not in data_cols and label not in custom_labels:
            custom_labels.append(label)

    ordered = [*MANDATORY_PREFIX, *data_cols, *custom_labels, *MANDATORY_SUFFIX]
    seen: set[str] = set()
    out: list[str] = []
    for col in ordered:
        if col not in seen:
            out.append(col)
            seen.add(col)
    return out


def normalize_custom_fields(raw: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in raw or []:
        label = str(item.get("label") or "").strip()
        if not label:
            continue
        field_type = str(item.get("fieldType") or item.get("field_type") or "text").lower()
        if field_type not in ("text", "dropdown", "number", "date"):
            field_type = "text"
        options = [str(o).strip() for o in (item.get("options") or []) if str(o).strip()]
        out.append({"label": label, "fieldType": field_type, "options": options})
    return out


EDITABLE_TRACKER_LABELS: list[str] = [
    "Dial Attempt #",
    "Connection",
    "Disposition (Outcome)",
    "Outcome comment",
    "Follow-up Action",
    "Follow-up Date",
]


def editable_column_labels(
    export_cols: list[str],
    custom_fields: list[dict[str, Any]] | None = None,
) -> list[str]:
    """Column labels agents may fill in (trackers + custom fields)."""
    custom_fields = custom_fields or []
    out = list(EDITABLE_TRACKER_LABELS)
    out.extend(str(f.get("label") or "").strip() for f in custom_fields if f.get("label"))
    seen: set[str] = set()
    unique: list[str] = []
    for label in out:
        if label and label not in seen:
            unique.append(label)
            seen.add(label)
    return unique


def build_workbook_schema_snapshot(
    export_cols: list[str],
    custom_fields: list[dict[str, Any]] | None,
    *,
    generated_at: str,
) -> dict[str, Any]:
    """Frozen column contract for a broadcast — stored on generate for response ingest."""
    custom_fields = normalize_custom_fields(custom_fields)
    custom_by_label = {f["label"]: f for f in custom_fields}
    ordered = build_workbook_column_order(export_cols, custom_fields)
    columns: list[dict[str, Any]] = []

    for label in ordered:
        meta: dict[str, Any] = {
            "key": label,
            "label": label,
            "source": "system",
            "fieldType": "text",
            "editable": False,
            "options": [],
        }
        if label in MANDATORY_PREFIX:
            meta["source"] = "system"
            if label == "Dial Attempt #":
                meta["editable"] = True
        elif label in export_cols or label in COMPULSORY_DATA_LABELS:
            meta["source"] = "lead"
        elif label in MANDATORY_SUFFIX:
            meta["source"] = "tracker"
            if label in EDITABLE_TRACKER_LABELS:
                meta["editable"] = True
            if label in MANDATORY_DROPDOWNS:
                meta["fieldType"] = "dropdown"
                meta["options"] = MANDATORY_DROPDOWNS[label]
        if label in custom_by_label:
            field = custom_by_label[label]
            meta["source"] = "custom"
            meta["editable"] = True
            meta["fieldType"] = field["fieldType"]
            meta["options"] = field.get("options") or []
        columns.append(meta)

    return {
        "version": 1,
        "generated_at": generated_at,
        "column_order": ordered,
        "columns": columns,
        "upsert_keys": ["staff_no", "assigned_date", "msisdn_clean"],
        "editable_keys": editable_column_labels(export_cols, custom_fields),
    }
