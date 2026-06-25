"""Pydantic models for agents and roster API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class AgentSummary(BaseModel):
    staff_no: str
    staff_name: str
    active: bool = True
    absent_dates: list[str] = Field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None


class AgentCollectionResponse(BaseModel):
    agents: list[AgentSummary]


class CreateAgentRequest(BaseModel):
    staff_no: str = Field(min_length=1, max_length=40)
    staff_name: str = Field(min_length=1, max_length=200)
    active: bool = True


class UpdateAgentRequest(BaseModel):
    staff_name: str | None = Field(default=None, min_length=1, max_length=200)
    active: bool | None = None


class RosterAbsence(BaseModel):
    absence_id: str
    staff_no: str
    staff_name: str = ""
    absent_date: str
    note: str = ""
    created_at: datetime | None = None


class RosterCollectionResponse(BaseModel):
    absences: list[RosterAbsence]


class CreateAbsenceRequest(BaseModel):
    staff_no: str = Field(min_length=1, max_length=40)
    absent_date: str = Field(min_length=10, max_length=10)
    note: str = Field(default="", max_length=500)


class GenerateBroadcastResponse(BaseModel):
    broadcast_id: str
    output_dir: str
    generated_at: datetime
    files_written: list[str]
    rows_assigned: int
    agent_day_slots: int
    responses_seeded: int = 0


class DuplicateBroadcastResponse(BaseModel):
    broadcast: dict
