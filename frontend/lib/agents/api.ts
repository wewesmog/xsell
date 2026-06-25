const API_BASE = process.env.NEXT_PUBLIC_XSELL_API_BASE_URL ?? "http://localhost:8000"

export type AgentSummary = {
  staff_no: string
  staff_name: string
  active: boolean
  absent_dates: string[]
  created_at: string
  updated_at: string
}

export type RosterAbsence = {
  absence_id: string
  staff_no: string
  staff_name: string
  absent_date: string
  note: string
  created_at: string
}

async function parseError(res: Response, fallback: string) {
  const msg = await res.text()
  throw new Error(msg || fallback)
}

export async function fetchAgents(activeOnly = false): Promise<AgentSummary[]> {
  const query = activeOnly ? "?active_only=true" : ""
  const res = await fetch(`${API_BASE}/api/agents${query}`)
  if (!res.ok) await parseError(res, "Failed to load agents")
  const data = (await res.json()) as { agents: AgentSummary[] }
  return data.agents
}

/** Roster for schedule: active agents + absent dates (optional date window). */
export async function fetchRoster(params?: {
  from?: string
  to?: string
  activeOnly?: boolean
}): Promise<AgentSummary[]> {
  const q = new URLSearchParams()
  if (params?.activeOnly !== false) q.set("active_only", "true")
  if (params?.from) q.set("from", params.from)
  if (params?.to) q.set("to", params.to)
  const suffix = q.toString() ? `?${q}` : ""
  const res = await fetch(`${API_BASE}/api/roster${suffix}`)
  if (!res.ok) await parseError(res, "Failed to load roster")
  const data = (await res.json()) as { agents: AgentSummary[] }
  return data.agents
}

export async function createAgentApi(params: {
  staffNo: string
  staffName: string
  active?: boolean
}): Promise<AgentSummary> {
  const res = await fetch(`${API_BASE}/api/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      staff_no: params.staffNo.trim().toUpperCase(),
      staff_name: params.staffName.trim(),
      active: params.active ?? true,
    }),
  })
  if (!res.ok) await parseError(res, "Failed to create agent")
  return (await res.json()) as AgentSummary
}

export async function updateAgentApi(
  staffNo: string,
  params: { staffName?: string; active?: boolean }
): Promise<AgentSummary> {
  const res = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(staffNo)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      staff_name: params.staffName,
      active: params.active,
    }),
  })
  if (!res.ok) await parseError(res, "Failed to update agent")
  return (await res.json()) as AgentSummary
}

export async function deleteAgentApi(staffNo: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(staffNo)}`, {
    method: "DELETE",
  })
  if (!res.ok) await parseError(res, "Failed to delete agent")
}

export async function fetchAbsences(params?: {
  from?: string
  to?: string
}): Promise<RosterAbsence[]> {
  const q = new URLSearchParams()
  if (params?.from) q.set("from", params.from)
  if (params?.to) q.set("to", params.to)
  const suffix = q.toString() ? `?${q}` : ""
  const res = await fetch(`${API_BASE}/api/roster/absences${suffix}`)
  if (!res.ok) await parseError(res, "Failed to load roster")
  const data = (await res.json()) as { absences: RosterAbsence[] }
  return data.absences
}

export async function createAbsenceApi(params: {
  staffNo: string
  absentDate: string
  note?: string
}): Promise<RosterAbsence> {
  const res = await fetch(`${API_BASE}/api/roster/absences`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      staff_no: params.staffNo,
      absent_date: params.absentDate,
      note: params.note ?? "",
    }),
  })
  if (!res.ok) await parseError(res, "Failed to record absence")
  return (await res.json()) as RosterAbsence
}

export async function deleteAbsenceApi(absenceId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/roster/absences/${absenceId}`, {
    method: "DELETE",
  })
  if (!res.ok) await parseError(res, "Failed to delete absence")
}

/** Shape used by schedule wizard (camelCase). */
export function toRosterEntry(agent: AgentSummary) {
  return {
    staffNo: agent.staff_no,
    staffName: agent.staff_name,
    active: agent.active,
    absentDates: agent.absent_dates,
  }
}

export type RosterEntry = ReturnType<typeof toRosterEntry>
