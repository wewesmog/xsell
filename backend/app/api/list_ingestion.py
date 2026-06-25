from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from app.models.list_ingestion_models import (
    ApproveListResponse,
    ArchiveListResponse,
    CancelListResponse,
    CleanStatsResponse,
    ListCollectionResponse,
    ListColumnsResponse,
    ListDetailResponse,
    ListSort,
    ListSummary,
    PreviewListResponse,
    UploadListResponse,
    parse_column_mapping_json,
)
from app.xsell_helpers.canon_main import (
    approve_list,
    archive_list,
    cancel_list_upload,
    clean_list,
    create_list_upload,
    get_list_status,
    get_list_columns,
    list_lists,
    preview_list_upload,
)

router = APIRouter(tags=["list-ingestion"])


@router.post("/lists/preview", response_model=PreviewListResponse)
async def preview_list(file: UploadFile = File(...)) -> PreviewListResponse:
    """Return headers and sample rows from any supported tabular upload."""
    try:
        result = await preview_list_upload(file)
        return PreviewListResponse.model_validate(result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Preview failed: {exc}") from exc


@router.post("/lists/upload", response_model=UploadListResponse)
async def upload_list(
    file: UploadFile = File(...),
    list_name: str = Form(...),
    uploaded_by: str = Form("frontend-user"),
    mapping_json: str = Form("{}"),
) -> UploadListResponse:
    try:
        validated_mapping = parse_column_mapping_json(mapping_json) or "{}"
        created = await create_list_upload(
            file=file,
            list_name=list_name,
            uploaded_by=uploaded_by,
            mapping_json=validated_mapping,
        )
        return UploadListResponse.model_validate(created)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - safety net
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}") from exc


@router.post("/lists/{list_id}/clean", response_model=CleanStatsResponse)
def clean_uploaded_list(
    list_id: str,
    list_name: str | None = Form(default=None),
    mapping_json: str | None = Form(default=None),
) -> CleanStatsResponse:
    """Clean staged file; returns stats with status=processing for user review."""
    try:
        validated_mapping = parse_column_mapping_json(mapping_json)
        result = clean_list(
            list_id,
            list_name=list_name,
            mapping_json=validated_mapping,
        )
        return CleanStatsResponse.model_validate(result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Clean failed: {exc}") from exc


@router.post("/lists/{list_id}/approve", response_model=ApproveListResponse)
def approve_uploaded_list(
    list_id: str,
    list_name: str | None = Form(default=None),
) -> ApproveListResponse:
    """Approve after user has reviewed clean stats."""
    try:
        result = approve_list(list_id, list_name=list_name)
        return ApproveListResponse.model_validate(result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Approve failed: {exc}") from exc


@router.post("/lists/{list_id}/cancel", response_model=CancelListResponse)
def cancel_uploaded_list(list_id: str) -> CancelListResponse:
    """Discard staged upload or cleaned-but-unapproved list."""
    try:
        result = cancel_list_upload(list_id)
        return CancelListResponse.model_validate(result)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/lists", response_model=ListCollectionResponse)
def get_lists(
    include_archived: bool = False,
    limit: int | None = Query(default=None, ge=1),
    search: str | None = Query(default=None, min_length=1, max_length=200),
    sort: ListSort = ListSort.newest,
) -> ListCollectionResponse:
    try:
        rows = list_lists(
            include_archived=include_archived,
            limit=limit,
            search=search,
            sort=sort.value,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ListCollectionResponse(lists=[ListSummary.model_validate(r) for r in rows])


@router.get("/lists/{list_id}/columns", response_model=ListColumnsResponse)
def list_columns(list_id: str) -> ListColumnsResponse:
    columns = get_list_columns(list_id)
    if not columns:
        raise HTTPException(status_code=404, detail="List not found")
    return ListColumnsResponse.model_validate(columns)


@router.get("/lists/{list_id}/status", response_model=ListDetailResponse)
def list_status(list_id: str) -> ListDetailResponse:
    status = get_list_status(list_id)
    if not status:
        raise HTTPException(status_code=404, detail="List not found")
    return ListDetailResponse.model_validate(status)


@router.post("/lists/{list_id}/archive", response_model=ArchiveListResponse)
def archive_uploaded_list(list_id: str) -> ArchiveListResponse:
    """Soft-disable: sets status=archived (no hard delete)."""
    try:
        result = archive_list(list_id)
        return ArchiveListResponse.model_validate(result)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
