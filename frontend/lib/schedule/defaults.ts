import type { CampaignDraft } from "./types"

export const defaultCampaignDraft = (): CampaignDraft => ({
  campaign: {
    campaignId: "",
    campaignName: "",
    broadcastId: "",
    broadcastName: "",
  },
  leads: {
    fileName: "",
    listName: "",
    headers: [],
    previewRows: [],
    rowCount: 0,
    msisdnColumn: "",
    nameColumn: "",
    columnRenames: [],
    exclusionsEnabled: true,
    exclusionsLookbackDays: 60,
    exclusionProductNames: [],
    exclusionLists: [],
    poolSize: 0,
    excludedCount: 0,
  },
  ranking: {
    criteria: [],
    winsorize: "p5-p95",
    agentVisibleColumns: ["Mobile Number"],
    includeManagerColumns: true,
  },
  assignment: {
    mode: "fair",
    fairnessColumn: "",
  },
  agents: {
    selectedStaffNos: [],
    useFirstN: false,
    firstN: 25,
    search: "",
  },
  volume: {
    leadsPerAgentPerDay: 150,
    internalName: "",
    customFields: [],
  },
  schedule: {
    mode: "range",
    startDate: new Date().toISOString().slice(0, 10),
    numDays: 1,
    specificDates: [],
  },
  review: {
    acknowledgeWarnings: false,
  },
})
