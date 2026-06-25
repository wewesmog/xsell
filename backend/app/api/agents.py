from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models.agent_models import (
    AgentCollectionResponse,
    AgentSummary,
    CreateAbsenceRequest,
    CreateAgentRequest,
    RosterAbsence,
    RosterCollectionResponse,
    UpdateAgentRequest,
)
from app.xsell_helpers.agents_main import (
    create_absence,
    create_agent,
    delete_absence,
    delete_agent,
    get_agent,
    list_absences,
    list_agents,
    list_roster,
    update_agent,
)

router = APIRouter(tags=["agents"])


@router.get("/roster", response_model=AgentCollectionResponse)
def get_roster(
    active_only: bool = Query(default=True),
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
) -> AgentCollectionResponse:
    """Schedule-facing roster: agents + absent dates (optionally filtered to a date window)."""
    try:
        rows = list_roster(active_only=active_only, from_date=from_date, to_date=to_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AgentCollectionResponse(agents=[AgentSummary.model_validate(r) for r in rows])


@router.get("/agents", response_model=AgentCollectionResponse)
def get_agents(active_only: bool = Query(default=False)) -> AgentCollectionResponse:
    try:
        rows = list_agents(active_only=active_only)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AgentCollectionResponse(agents=[AgentSummary.model_validate(r) for r in rows])


@router.post("/agents", response_model=AgentSummary)
def post_agent(body: CreateAgentRequest) -> AgentSummary:
    try:
        row = create_agent(
            staff_no=body.staff_no,
            staff_name=body.staff_name,
            active=body.active,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AgentSummary.model_validate(row)


@router.get("/agents/{staff_no}", response_model=AgentSummary)
def get_agent_by_id(staff_no: str) -> AgentSummary:
    row = get_agent(staff_no)
    if not row:
        raise HTTPException(status_code=404, detail="Agent not found")
    return AgentSummary.model_validate(row)


@router.patch("/agents/{staff_no}", response_model=AgentSummary)
def patch_agent(staff_no: str, body: UpdateAgentRequest) -> AgentSummary:
    try:
        row = update_agent(
            staff_no,
            staff_name=body.staff_name,
            active=body.active,
        )
    except ValueError as exc:
        status = 404 if "not found" in str(exc).lower() else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    return AgentSummary.model_validate(row)


@router.delete("/agents/{staff_no}")
def remove_agent(staff_no: str) -> dict[str, str]:
    try:
        delete_agent(staff_no)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"status": "deleted", "staff_no": staff_no}


@router.get("/roster/absences", response_model=RosterCollectionResponse)
def get_absences(
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
) -> RosterCollectionResponse:
    rows = list_absences(from_date=from_date, to_date=to_date)
    return RosterCollectionResponse(
        absences=[RosterAbsence.model_validate(r) for r in rows]
    )


@router.post("/roster/absences", response_model=RosterAbsence)
def post_absence(body: CreateAbsenceRequest) -> RosterAbsence:
    try:
        row = create_absence(
            staff_no=body.staff_no,
            absent_date=body.absent_date,
            note=body.note,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return RosterAbsence.model_validate(row)


@router.delete("/roster/absences/{absence_id}")
def remove_absence(absence_id: str) -> dict[str, str]:
    try:
        delete_absence(absence_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"status": "deleted", "absence_id": absence_id}
