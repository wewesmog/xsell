import { defaultCampaignDraft } from "./defaults"
import type { CampaignDraft } from "./types"

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

  const rankingEnabled =
    ranking.enabled ?? ((ranking.criteria?.length ?? 0) > 0 ? true : base.ranking.enabled)
  const assignmentMode = values.assignment?.mode ?? base.assignment.mode

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
      enabled: rankingEnabled,
      criteria: ranking.criteria ?? base.ranking.criteria,
      includeManagerColumns: ranking.includeManagerColumns ?? true,
    },
    assignment: {
      ...base.assignment,
      ...values.assignment,
      mode: rankingEnabled ? assignmentMode : "random",
      fairnessColumn: rankingEnabled ? (values.assignment?.fairnessColumn ?? "") : "",
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
