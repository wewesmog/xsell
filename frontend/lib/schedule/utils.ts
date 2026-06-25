import { format, parseISO } from "date-fns"
import type { CampaignDraft } from "./types"
import { resolveScheduleDates, countEligibleAgentDays } from "./schema"
import type { RosterEntry } from "@/lib/agents/api"

export function formatDisplayDate(iso: string) {
  try {
    return format(parseISO(iso), "dd-MMM-yyyy")
  } catch {
    return iso
  }
}

export function getNumericColumns(headers: string[], rows: Record<string, string>[]) {
  return headers.filter((h) => {
    const sample = rows.slice(0, 50).map((r) => r[h]).filter(Boolean)
    if (sample.length === 0) return false
    return sample.every((v) => !Number.isNaN(Number(String(v).replace(/,/g, ""))))
  })
}

/** Split 100% across N fields as evenly as possible (remainder on first items). */
export function equalWeights(count: number): number[] {
  if (count <= 0) return []
  const base = Math.floor(100 / count)
  const weights = Array.from({ length: count }, () => base)
  let remainder = 100 - base * count
  for (let i = 0; i < count && remainder > 0; i += 1, remainder -= 1) {
    weights[i] += 1
  }
  return weights
}

export function applyEqualWeights<T extends { weight: number }>(items: T[]): T[] {
  const weights = equalWeights(items.length)
  return items.map((item, index) => ({ ...item, weight: weights[index] ?? 0 }))
}

export function computePoolSize(rowCount: number, excluded: number) {
  return Math.max(0, rowCount - excluded)
}

export function getAgentLabel(staffNo: string, roster: RosterEntry[] = []) {
  const a = roster.find((x) => x.staffNo === staffNo)
  return a ? `${a.staffNo} — ${a.staffName}` : staffNo
}

export function summarizeDraft(data: CampaignDraft, roster: RosterEntry[] = []) {
  const dates = resolveScheduleDates(data.schedule)
  const agentDays = countEligibleAgentDays(data, roster)
  const perDay = data.volume.leadsPerAgentPerDay
  const required = agentDays * perDay

  return {
    dates,
    agentCount: data.agents.selectedStaffNos.length,
    agentDays,
    perDay,
    required,
    pool: data.leads.poolSize,
    gap: data.leads.poolSize - required,
  }
}
