"""Pydantic models for list ingestion API (enums must match migrations/001_list_ingestion_schema.sql)."""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class ListDbStatus(str, Enum):
    processing = "processing"
    ready = "ready"
    archived = "archived"


class ListSort(str, Enum):
    newest = "newest"
    oldest = "oldest"
    name_asc = "name_asc"
    name_desc = "name_desc"
    rows_desc = "rows_desc"
    rows_asc = "rows_asc"


class StagingStatus(str, Enum):
    pending = "pending"
    canceled = "canceled"


class RowDecision(str, Enum):
    pending = "pending"
    keep = "keep"
    drop = "drop"
    merge = "merge"


class ColumnRename(BaseModel):
    sourceHeader: str
    displayLabel: str
    includeInExport: bool = True


class ColumnMapping(BaseModel):
    msisdnColumn: str = ""
    nameColumn: str = ""
    columnRenames: list[ColumnRename] = Field(default_factory=list)


class UploadListResponse(BaseModel):
    list_id: str
    file_name: str
    status: StagingStatus


class CleanStatsResponse(BaseModel):
    list_id: str
    status: ListDbStatus
    raw_count: int = Field(ge=0)
    clean_count: int = Field(ge=0)
    duplicate_count: int = Field(ge=0)


class ApproveListResponse(BaseModel):
    list_id: str
    status: ListDbStatus
    raw_count: int = Field(ge=0)
    clean_count: int = Field(ge=0)
    duplicate_count: int = Field(ge=0)


class CancelListResponse(BaseModel):
    list_id: str
    status: StagingStatus


class ArchiveListResponse(BaseModel):
    list_id: str
    status: ListDbStatus


class ListSummary(BaseModel):
    list_id: str
    list_name: str
    uploaded_by: str
    status: ListDbStatus
    row_count_clean: int = Field(ge=0)
    uploaded_on: datetime
    updated_on: datetime


class ListCollectionResponse(BaseModel):
    lists: list[ListSummary]


class ListDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    list_id: str
    list_name: str
    uploaded_by: str | None = None
    status: ListDbStatus
    row_count_raw: int = Field(ge=0)
    row_count_clean: int = Field(ge=0)
    uploaded_on: datetime | None = None
    updated_on: datetime


class ListColumnsResponse(BaseModel):
    list_id: str
    headers: list[str]
    numeric_columns: list[str]
    msisdn_column: str = ""
    name_column: str = ""
    preview_rows: list[dict[str, str]] = Field(default_factory=list)


class PreviewListResponse(BaseModel):
    file_name: str
    headers: list[str]
    preview_rows: list[dict[str, str]] = Field(default_factory=list)
    row_count: int = Field(ge=0)


def parse_column_mapping_json(raw: str | None) -> str | None:
    """Validate mapping_json form field; return normalized JSON string for storage."""
    if raw is None:
        return None
    payload = raw.strip() or "{}"
    mapping = ColumnMapping.model_validate_json(payload)
    return mapping.model_dump_json()
