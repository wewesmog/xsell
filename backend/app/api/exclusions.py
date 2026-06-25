from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.shared_services.oracle_db import oracle_configured
from app.xsell_helpers.oracle_exclusions import (
    list_exclusion_campaigns,
    preview_exclusions,
)

router = APIRouter(tags=["exclusions"])


class ExclusionPreviewRequest(BaseModel):
    list_id: str = Field(min_length=1)
    exclusions_enabled: bool = True
    lookback_days: int = Field(default=60, ge=1, le=365)
    exclusion_list_ids: list[str] = Field(default_factory=list)
    exclusion_product_names: list[str] = Field(default_factory=list)


class ExclusionPreviewResponse(BaseModel):
    list_id: str
    lead_row_count: int = Field(ge=0)
    exclusions_enabled: bool
    lookback_days: int
    exclusion_list_ids: list[str]
    exclusion_product_names: list[str] = Field(default_factory=list)
    oracle_available: bool
    oracle_error: str | None = None
    oracle_exclusion_total: int = Field(ge=0)
    oracle_overlap: int = Field(ge=0)
    list_overlap: int = Field(ge=0)
    excluded_count: int = Field(ge=0)
    pool_size: int = Field(ge=0)


class ExclusionCampaignsResponse(BaseModel):
    lookback_days: int
    campaigns: list[str]
    oracle_available: bool
    oracle_error: str | None = None


@router.get("/exclusions/campaigns", response_model=ExclusionCampaignsResponse)
def exclusion_campaigns(
    lookback_days: int = Query(default=60, ge=1, le=365),
) -> ExclusionCampaignsResponse:
    """Product names (campaigns) in CONVERSIONS_FINAL within the lookback window."""
    if not oracle_configured():
        return ExclusionCampaignsResponse(
            lookback_days=lookback_days,
            campaigns=[],
            oracle_available=False,
            oracle_error="Oracle is not configured. Set ORACLE_* variables in backend/.env",
        )
    try:
        campaigns = list_exclusion_campaigns(lookback_days, use_cache=True)
        return ExclusionCampaignsResponse(
            lookback_days=lookback_days,
            campaigns=campaigns,
            oracle_available=True,
        )
    except Exception as exc:
        return ExclusionCampaignsResponse(
            lookback_days=lookback_days,
            campaigns=[],
            oracle_available=True,
            oracle_error=str(exc),
        )


@router.post("/exclusions/preview", response_model=ExclusionPreviewResponse)
def exclusion_preview(body: ExclusionPreviewRequest) -> ExclusionPreviewResponse:
    try:
        result = preview_exclusions(
            list_id=body.list_id.strip(),
            exclusions_enabled=body.exclusions_enabled,
            lookback_days=body.lookback_days,
            exclusion_list_ids=[lid.strip() for lid in body.exclusion_list_ids if lid.strip()],
            exclusion_product_names=[
                name.strip() for name in body.exclusion_product_names if name.strip()
            ],
        )
        return ExclusionPreviewResponse.model_validate(result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Exclusion preview failed: {exc}") from exc
