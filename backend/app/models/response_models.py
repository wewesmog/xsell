"""Pydantic models for broadcast agent responses API."""

from typing import Any

from pydantic import BaseModel, Field


class WorkbookSchemaResponse(BaseModel):
    broadcast_id: str
    schema: dict[str, Any] = Field(default_factory=dict)


class BroadcastResponseRow(BaseModel):
    response_id: str
    broadcast_id: str
    staff_no: str
    assigned_date: str
    msisdn_clean: str
    lead_id: str | None = None
    assignment_json: dict[str, Any] = Field(default_factory=dict)
    responses_json: dict[str, Any] = Field(default_factory=dict)
    created_at: str = ""
    updated_at: str = ""


class BroadcastResponseCollection(BaseModel):
    broadcast_id: str
    responses: list[BroadcastResponseRow]
    total: int


class UpsertResponseItem(BaseModel):
    staff_no: str = Field(min_length=1, max_length=40)
    assigned_date: str = Field(min_length=10, max_length=10)
    msisdn: str = Field(min_length=9, max_length=20)
    lead_id: str | None = None
    fields: dict[str, Any] = Field(default_factory=dict)
    assignment: dict[str, Any] = Field(default_factory=dict)


class UpsertResponsesRequest(BaseModel):
    responses: list[UpsertResponseItem] = Field(min_length=1)


class UpsertResponsesResult(BaseModel):
    broadcast_id: str
    saved_count: int
    saved: list[BroadcastResponseRow]
    errors: list[dict[str, str]] = Field(default_factory=list)
