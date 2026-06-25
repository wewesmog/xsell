"""Pydantic models for campaigns and broadcasts API."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class EntityStatus(str, Enum):
    active = "active"
    inactive = "inactive"


class CreateCampaignRequest(BaseModel):
    campaign_name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    created_by: str = Field(default="frontend-user", max_length=120)


class UpdateCampaignRequest(BaseModel):
    campaign_name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    status: EntityStatus | None = None


class CampaignSummary(BaseModel):
    campaign_id: str
    campaign_name: str
    description: str = ""
    status: EntityStatus = EntityStatus.active
    created_by: str
    created_at: datetime
    updated_at: datetime
    broadcast_count: int = 0


class CampaignCollectionResponse(BaseModel):
    campaigns: list[CampaignSummary]


class CreateCampaignResponse(BaseModel):
    campaign: CampaignSummary


class CreateBroadcastRequest(BaseModel):
    campaign_id: str
    broadcast_name: str = Field(min_length=1, max_length=200)
    config_json: dict[str, Any]
    created_by: str = Field(default="frontend-user", max_length=120)


class UpdateBroadcastRequest(BaseModel):
    broadcast_name: str | None = Field(default=None, min_length=1, max_length=200)
    campaign_id: str | None = None
    config_json: dict[str, Any] | None = None
    status: EntityStatus | None = None


class BroadcastSummary(BaseModel):
    broadcast_id: str
    campaign_id: str
    campaign_name: str = ""
    broadcast_name: str
    status: EntityStatus = EntityStatus.active
    lead_list_id: str | None = None
    pool_size: int = 0
    schedule_dates: list[str] = Field(default_factory=list)
    generated_at: datetime | None = None
    output_dir: str | None = None
    created_by: str
    created_at: datetime
    updated_at: datetime


class BroadcastDetail(BroadcastSummary):
    config_json: dict[str, Any] = Field(default_factory=dict)


class BroadcastCollectionResponse(BaseModel):
    broadcasts: list[BroadcastSummary]


class CreateBroadcastResponse(BaseModel):
    broadcast: BroadcastDetail
