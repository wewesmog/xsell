import type { CampaignDraft } from "./types"
import { resolveScheduleDates } from "./schema"
import { countEligibleAgents } from "./schema"
import type { RosterEntry } from "@/lib/agents/api"

export type AssignmentMode = CampaignDraft["assignment"]["mode"]

export type AgentDayShare = {
  date: string
  staffNo: string
  staffName: string
  leadCount: number
  fairnessSum: number
}

export const ASSIGNMENT_MODE_OPTIONS: {
  value: AssignmentMode
  id: string
  label: string
}[] = [
  {
    value: "fair",
    id: "assign-fair",
    label: "Fair by column (greedy balance)",
  },
  {
    value: "fair_even",
    id: "assign-even",
    label: "Fair by column (even spread)",
  },
  {
    value: "random",
    id: "assign-random",
    label: "Random round-robin",
  },
]

export function assignmentModeLabel(mode: AssignmentMode): string {
  return ASSIGNMENT_MODE_OPTIONS.find((o) => o.value === mode)?.label ?? mode
}

/** Short hint under each mode radio — reflects the selected fairness column when set. */
export function assignmentModeHint(
  mode: AssignmentMode,
  fairnessColumn?: string
): string {
  const col = fairnessColumn?.trim()
  switch (mode) {
    case "fair":
      return col
        ? `Each lead goes to the agent-day with the lowest running total of ${col}.`
        : "Choose a numeric column below; leads are assigned to balance its sum per agent-day."
    case "fair_even":
      return col
        ? `Leads are stratified by ${col} (low / mid / high) so each agent-day gets a similar mix.`
        : "Choose a numeric column below; leads are stratified into low/mid/high buckets per agent-day."
    case "random":
      return "Leads are shuffled, then distributed round-robin up to each agent-day quota."
  }
}

/** One-line summary for review / side panels. */
export function formatAssignmentSummary(assignment: CampaignDraft["assignment"]): string {
  const label = assignmentModeLabel(assignment.mode)
  if (assignment.mode === "random" || !assignment.fairnessColumn?.trim()) {
    return label
  }
  return `${label} · balancing on ${assignment.fairnessColumn}`
}

/** Strategy description for the sharing preview card header. */
export function describeAssignmentStrategy(draft: CampaignDraft): string {
  return assignmentModeHint(draft.assignment.mode, draft.assignment.fairnessColumn)
}

/** Runtime rules paragraph — all values from the draft. */
export function describeSharingRun(draft: CampaignDraft): string {
  const quota = draft.volume.leadsPerAgentPerDay
  const phoneLabel = draft.leads.msisdnColumn?.trim() || "the phone column you selected"
  const leadPhrase = draft.ranking.enabled ? "After ranking, each agent-day" : "Each agent-day"
  return `${leadPhrase} receives up to ${quota} leads (daily quota from Volume). One ${phoneLabel} per agent-day; duplicates are removed and back-filled from the reserve pool.`
}

export function getSharingPreviewBlockers(draft: CampaignDraft): string[] {
  const blockers: string[] = []
  const { mode, fairnessColumn } = draft.assignment

  if ((mode === "fair" || mode === "fair_even") && !fairnessColumn?.trim()) {
    blockers.push("Select a fairness column above.")
  }
  if (draft.agents.selectedStaffNos.length === 0) {
    blockers.push("Select agents in the Agents step.")
  }
  if (resolveScheduleDates(draft.schedule).length === 0) {
    blockers.push("Set campaign days in the Schedule step.")
  }
  return blockers
}

/** Approximate preview of how ranked leads are shared across agent-days. */
export function previewLeadSharing(
  draft: CampaignDraft,
  roster: RosterEntry[] = []
): AgentDayShare[] {
  const dates = resolveScheduleDates(draft.schedule)
  const perDay = draft.volume.leadsPerAgentPerDay
  const selected = draft.agents.selectedStaffNos
  const mode = draft.assignment.mode
  const hasFairness = Boolean(draft.assignment.fairnessColumn?.trim())

  const result: AgentDayShare[] = []
  let poolCursor = 0
  const poolSize = draft.leads.poolSize || 0
  const avgFairness =
    mode === "random" ? 120 : mode === "fair_even" ? 95 : 110

  for (const date of dates) {
    const eligible = selected.filter(
      (s) => countEligibleAgents(date, [s], roster) === 1
    )
    for (const staffNo of eligible) {
      const agent = roster.find((a) => a.staffNo === staffNo)
      const count = Math.min(perDay, Math.max(0, poolSize - poolCursor))
      poolCursor += count
      const spread =
        !hasFairness || mode === "random"
          ? 0
          : mode === "fair_even"
            ? avgFairness + (poolCursor % 5) * 8
            : avgFairness + (result.length % 3) * 15 - 15
      result.push({
        date,
        staffNo,
        staffName: agent?.staffName ?? staffNo,
        leadCount: count,
        fairnessSum: hasFairness ? Math.round(spread * count) : 0,
      })
    }
  }

  return result.slice(0, 24)
}
