"""Robust tabular file loading for list ingestion (CSV, TSV, TXT, Excel)."""

from __future__ import annotations

import csv
import logging
from io import StringIO
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS: frozenset[str] = frozenset(
    {".csv", ".tsv", ".txt", ".dat", ".xlsx", ".xls"}
)

# Map odd extensions to a reader strategy when content is plain text.
_TEXT_LIKE_EXTENSIONS: frozenset[str] = frozenset({".csv", ".tsv", ".txt", ".dat"})


def extension_for_filename(filename: str) -> str:
    return Path(filename or "").suffix.lower()


def is_supported_upload(filename: str) -> bool:
    ext = extension_for_filename(filename)
    if ext in SUPPORTED_EXTENSIONS:
        return True
    # Allow extensionless files — we'll sniff content on read.
    return ext == ""


def _read_text_with_sniff(path: Path, *, sep_hint: str | None = None) -> pd.DataFrame:
    raw = path.read_text(encoding="utf-8-sig", errors="replace")
    if not raw.strip():
        return pd.DataFrame()

    if sep_hint:
        return pd.read_csv(StringIO(raw), sep=sep_hint, dtype=str).fillna("")

    try:
        dialect = csv.Sniffer().sniff(raw[:8192], delimiters=",\t|;")
        sep = dialect.delimiter
    except csv.Error:
        # Fallback: tab if more tabs than commas, else comma.
        head = raw[:8192]
        sep = "\t" if head.count("\t") > head.count(",") else ","

    return pd.read_csv(StringIO(raw), sep=sep, dtype=str, engine="python").fillna("")


def _read_excel(path: Path) -> pd.DataFrame:
    # First sheet; all columns as string to preserve MSISDN leading zeros.
    return pd.read_excel(path, dtype=str, sheet_name=0).fillna("")


def read_tabular_file(path: Path, *, original_name: str | None = None) -> pd.DataFrame:
    """Load a user upload into a normalized string DataFrame."""
    if not path.exists():
        raise ValueError(f"File not found: {path}")

    ext = extension_for_filename(original_name or path.name)

    if ext in {".xlsx", ".xls"}:
        return _read_excel(path)

    if ext == ".tsv":
        return _read_text_with_sniff(path, sep_hint="\t")

    if ext in _TEXT_LIKE_EXTENSIONS or ext == "":
        return _read_text_with_sniff(path)

    # Last resort: try excel then delimited text.
    try:
        return _read_excel(path)
    except Exception:
        logger.debug("Excel read failed for %s, trying delimited text", path.name)
        return _read_text_with_sniff(path)


def normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Strip headers and drop wholly empty rows/columns."""
    if df.empty:
        return df
    out = df.copy()
    out.columns = [str(c).strip() for c in out.columns]
    out = out.loc[:, [c for c in out.columns if c and not str(c).startswith("Unnamed")]]
    out = out.dropna(how="all")
    out = out.loc[:, out.astype(str).apply(lambda col: col.str.strip().ne("").any())]
    return out.fillna("")
