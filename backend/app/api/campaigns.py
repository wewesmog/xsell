from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models.agent_models import GenerateBroadcastResponse
from app.models.campaign_models import (
    BroadcastCollectionResponse,
    BroadcastDetail,
    BroadcastSummary,
    CampaignCollectionResponse,
    CampaignSummary,
    CreateBroadcastRequest,
    CreateBroadcastResponse,
    CreateCampaignRequest,
    CreateCampaignResponse,
    UpdateBroadcastRequest,
    UpdateCampaignRequest,
)
from app.models.response_models import (
    BroadcastResponseCollection,
    BroadcastResponseRow,
    UpsertResponsesRequest,
    UpsertResponsesResult,
    WorkbookSchemaResponse,
)
from app.xsell_helpers.broadcast_generate import generate_broadcast_files
from app.xsell_helpers.broadcast_response_main import (
    get_workbook_schema,
    list_responses,
    upsert_responses_batch,
)
from app.xsell_helpers.broadcast_main import (
    create_broadcast,
    delete_broadcast,
    duplicate_broadcast,
    get_broadcast,
    list_broadcasts,
    update_broadcast,
)
from app.xsell_helpers.campaign_main import (
    create_campaign,
    delete_campaign,
    get_campaign,
    list_campaigns,
    update_campaign,
)

router = APIRouter(tags=["campaigns"])


@router.get("/campaigns", response_model=CampaignCollectionResponse)
def get_campaigns() -> CampaignCollectionResponse:
    try:
        rows = list_campaigns()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CampaignCollectionResponse(
        campaigns=[CampaignSummary.model_validate(r) for r in rows]
    )


@router.post("/campaigns", response_model=CreateCampaignResponse)
def post_campaign(body: CreateCampaignRequest) -> CreateCampaignResponse:
    try:
        row = create_campaign(
            campaign_name=body.campaign_name,
            description=body.description,
            created_by=body.created_by,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CreateCampaignResponse(campaign=CampaignSummary.model_validate(row))


@router.get("/campaigns/{campaign_id}", response_model=CampaignSummary)
def get_campaign_by_id(campaign_id: str) -> CampaignSummary:
    row = get_campaign(campaign_id)
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return CampaignSummary.model_validate(row)


@router.patch("/campaigns/{campaign_id}", response_model=CampaignSummary)
def patch_campaign(campaign_id: str, body: UpdateCampaignRequest) -> CampaignSummary:
    try:
        row = update_campaign(
            campaign_id,
            campaign_name=body.campaign_name,
            description=body.description,
            status=body.status.value if body.status else None,
        )
    except ValueError as exc:
        status = 404 if "not found" in str(exc).lower() else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    return CampaignSummary.model_validate(row)


@router.delete("/campaigns/{campaign_id}")
def remove_campaign(campaign_id: str) -> dict[str, str]:
    try:
        delete_campaign(campaign_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"status": "deleted", "campaign_id": campaign_id}


@router.get("/broadcasts", response_model=BroadcastCollectionResponse)
def get_broadcasts(
    campaign_id: str | None = Query(default=None),
) -> BroadcastCollectionResponse:
    try:
        rows = list_broadcasts(campaign_id=campaign_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return BroadcastCollectionResponse(
        broadcasts=[BroadcastSummary.model_validate(r) for r in rows]
    )


@router.post("/broadcasts", response_model=CreateBroadcastResponse)
def post_broadcast(body: CreateBroadcastRequest) -> CreateBroadcastResponse:
    try:
        row = create_broadcast(
            campaign_id=body.campaign_id,
            broadcast_name=body.broadcast_name,
            config_json=body.config_json,
            created_by=body.created_by,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CreateBroadcastResponse(broadcast=BroadcastDetail.model_validate(row))


@router.get("/broadcasts/{broadcast_id}", response_model=BroadcastDetail)
def get_broadcast_by_id(broadcast_id: str) -> BroadcastDetail:
    row = get_broadcast(broadcast_id)
    if not row:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    return BroadcastDetail.model_validate(row)


@router.patch("/broadcasts/{broadcast_id}", response_model=BroadcastDetail)
def patch_broadcast(broadcast_id: str, body: UpdateBroadcastRequest) -> BroadcastDetail:
    try:
        row = update_broadcast(
            broadcast_id,
            broadcast_name=body.broadcast_name,
            campaign_id=body.campaign_id,
            config_json=body.config_json,
            status=body.status.value if body.status else None,
        )
    except ValueError as exc:
        status = 404 if "not found" in str(exc).lower() else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    return BroadcastDetail.model_validate(row)


@router.delete("/broadcasts/{broadcast_id}")
def remove_broadcast(broadcast_id: str) -> dict[str, str]:
    try:
        delete_broadcast(broadcast_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"status": "deleted", "broadcast_id": broadcast_id}


@router.post("/broadcasts/{broadcast_id}/generate", response_model=GenerateBroadcastResponse)
def post_generate_broadcast(broadcast_id: str) -> GenerateBroadcastResponse:
    try:
        result = generate_broadcast_files(broadcast_id)
    except ValueError as exc:
        status = 404 if "not found" in str(exc).lower() else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    return GenerateBroadcastResponse.model_validate(result)


@router.post("/broadcasts/{broadcast_id}/duplicate", response_model=CreateBroadcastResponse)
def post_duplicate_broadcast(broadcast_id: str) -> CreateBroadcastResponse:
    try:
        row = duplicate_broadcast(broadcast_id)
    except ValueError as exc:
        status = 404 if "not found" in str(exc).lower() else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    return CreateBroadcastResponse(broadcast=BroadcastDetail.model_validate(row))


@router.get("/broadcasts/{broadcast_id}/workbook-schema", response_model=WorkbookSchemaResponse)
def get_broadcast_workbook_schema(broadcast_id: str) -> WorkbookSchemaResponse:
    if not get_broadcast(broadcast_id):
        raise HTTPException(status_code=404, detail="Broadcast not found")
    schema = get_workbook_schema(broadcast_id)
    if not schema:
        raise HTTPException(
            status_code=404,
            detail="Workbook schema not found — generate workbooks first",
        )
    return WorkbookSchemaResponse(broadcast_id=broadcast_id, schema=schema)


@router.get("/broadcasts/{broadcast_id}/responses", response_model=BroadcastResponseCollection)
def get_broadcast_responses(
    broadcast_id: str,
    staff_no: str | None = Query(default=None),
    assigned_date: str | None = Query(default=None),
) -> BroadcastResponseCollection:
    try:
        rows = list_responses(broadcast_id, staff_no=staff_no, assigned_date=assigned_date)
    except ValueError as exc:
        status = 404 if "not found" in str(exc).lower() else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    responses = [BroadcastResponseRow.model_validate(r) for r in rows]
    return BroadcastResponseCollection(
        broadcast_id=broadcast_id,
        responses=responses,
        total=len(responses),
    )


@router.post("/broadcasts/{broadcast_id}/responses", response_model=UpsertResponsesResult)
def post_broadcast_responses(
    broadcast_id: str,
    body: UpsertResponsesRequest,
) -> UpsertResponsesResult:
    items = [
        {
            "staff_no": item.staff_no,
            "assigned_date": item.assigned_date,
            "msisdn": item.msisdn,
            "lead_id": item.lead_id,
            "responses": item.fields,
            "assignment": item.assignment,
        }
        for item in body.responses
    ]
    try:
        result = upsert_responses_batch(broadcast_id, items)
    except ValueError as exc:
        status = 404 if "not found" in str(exc).lower() else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    return UpsertResponsesResult(
        broadcast_id=broadcast_id,
        saved_count=result["saved_count"],
        saved=[BroadcastResponseRow.model_validate(r) for r in result["saved"]],
        errors=result["errors"],
    )
