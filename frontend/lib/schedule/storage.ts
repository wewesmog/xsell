import { defaultCampaignDraft } from "./defaults"
import { STORAGE_KEY } from "./constants"
import type { CampaignDraft, StoredDraft } from "./types"

/** @deprecated Schedule no longer auto-restores from localStorage. */
export function loadDraft(): StoredDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredDraft
    if (!parsed?.values) return null
    return parsed
  } catch {
    return null
  }
}

/** @deprecated Schedule no longer auto-saves to localStorage. */
export function saveDraft(currentStep: number, values: CampaignDraft) {
  if (typeof window === "undefined") return
  const payload: StoredDraft = {
    savedAt: new Date().toISOString(),
    currentStep,
    values,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function clearDraft() {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
}
export function mergeWithDefaults(values: Partial<CampaignDraft>): CampaignDraft {
  const base = defaultCampaignDraft()
  const leads = { ...base.leads, ...values.leads }
  const ranking = { ...base.ranking, ...values.ranking }
  const columnRenames = (leads.columnRenames ?? []).map((r) => ({
    sourceHeader: r.sourceHeader,
    displayLabel: r.displayLabel || r.sourceHeader,
    includeInExport: r.includeInExport ?? true,
  }))

  const legacyLeads = values.leads as
    | (Partial<CampaignDraft["leads"]> & {
        exclusionsListId?: string
        exclusionsListName?: string
        exclusionsListRowCount?: number
      })
    | undefined

  let exclusionLists = leads.exclusionLists ?? []
  if (!exclusionLists.length && legacyLeads?.exclusionsListId) {
    exclusionLists = [
      {
        listId: legacyLeads.exclusionsListId,
        listName: legacyLeads.exclusionsListName ?? "",
        rowCount: legacyLeads.exclusionsListRowCount ?? 0,
      },
    ]
  }

  return {
    ...base,
    ...values,
    campaign: { ...base.campaign, ...values.campaign },
    leads: {
      ...leads,
      columnRenames,
      exclusionLists,
      exclusionProductNames: leads.exclusionProductNames ?? [],
    },
    ranking: {
      ...ranking,
      criteria: ranking.criteria ?? base.ranking.criteria,
      includeManagerColumns: ranking.includeManagerColumns ?? true,
    },
    assignment: {
      ...base.assignment,
      ...values.assignment,
      mode: values.assignment?.mode ?? base.assignment.mode,
    },
    agents: { ...base.agents, ...values.agents },
    volume: {
      ...base.volume,
      ...values.volume,
      customFields: values.volume?.customFields ?? base.volume.customFields,
    },
    schedule: { ...base.schedule, ...values.schedule },
    review: { ...base.review, ...values.review },
  }
}
