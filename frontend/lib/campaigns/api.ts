import type { CampaignDraft } from "@/lib/schedule/types"

const API_BASE = process.env.NEXT_PUBLIC_XSELL_API_BASE_URL ?? "http://localhost:8000"

export type EntityStatus = "active" | "inactive"

export type CampaignSummary = {
  campaign_id: string
  campaign_name: string
  description: string
  status: EntityStatus
  created_by: string
  created_at: string
  updated_at: string
  broadcast_count: number
}

export type BroadcastSummary = {
  broadcast_id: string
  campaign_id: string
  campaign_name: string
  broadcast_name: string
  status: EntityStatus
  lead_list_id: string | null
  pool_size: number
  schedule_dates: string[]
  generated_at: string | null
  output_dir: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type BroadcastDetail = BroadcastSummary & {
  config_json: CampaignDraft
}

async function parseError(res: Response, fallback: string) {
  const msg = await res.text()
  throw new Error(msg || fallback)
}

export async function fetchCampaigns(): Promise<CampaignSummary[]> {
  const res = await fetch(`${API_BASE}/api/campaigns`)
  if (!res.ok) await parseError(res, "Failed to load campaigns")
  const data = (await res.json()) as { campaigns: CampaignSummary[] }
  return data.campaigns
}

export async function createCampaignApi(params: {
  campaignName: string
  description?: string
  createdBy?: string
}): Promise<CampaignSummary> {
  const res = await fetch(`${API_BASE}/api/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      campaign_name: params.campaignName.trim(),
      description: params.description?.trim() ?? "",
      created_by: params.createdBy ?? "frontend-user",
    }),
  })
  if (!res.ok) await parseError(res, "Failed to create campaign")
  const data = (await res.json()) as { campaign: CampaignSummary }
  return data.campaign
}

export async function updateCampaignApi(
  campaignId: string,
  params: {
    campaignName?: string
    description?: string
    status?: EntityStatus
  }
): Promise<CampaignSummary> {
  const res = await fetch(`${API_BASE}/api/campaigns/${campaignId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      campaign_name: params.campaignName,
      description: params.description,
      status: params.status,
    }),
  })
  if (!res.ok) await parseError(res, "Failed to update campaign")
  return (await res.json()) as CampaignSummary
}

export async function deleteCampaignApi(campaignId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/campaigns/${campaignId}`, {
    method: "DELETE",
  })
  if (!res.ok) await parseError(res, "Failed to delete campaign")
}

export async function fetchCampaignById(
  campaignId: string
): Promise<CampaignSummary | null> {
  const res = await fetch(`${API_BASE}/api/campaigns/${campaignId}`)
  if (res.status === 404) return null
  if (!res.ok) await parseError(res, "Failed to load campaign")
  return (await res.json()) as CampaignSummary
}

export async function fetchBroadcasts(
  campaignId?: string
): Promise<BroadcastSummary[]> {
  const query = campaignId ? `?campaign_id=${encodeURIComponent(campaignId)}` : ""
  const res = await fetch(`${API_BASE}/api/broadcasts${query}`)
  if (!res.ok) await parseError(res, "Failed to load broadcasts")
  const data = (await res.json()) as { broadcasts: BroadcastSummary[] }
  return data.broadcasts
}

export async function fetchBroadcastById(
  broadcastId: string
): Promise<BroadcastDetail | null> {
  const res = await fetch(`${API_BASE}/api/broadcasts/${broadcastId}`)
  if (res.status === 404) return null
  if (!res.ok) await parseError(res, "Failed to load broadcast")
  return (await res.json()) as BroadcastDetail
}

export async function createBroadcastApi(params: {
  campaignId: string
  broadcastName: string
  configJson: CampaignDraft
  createdBy?: string
}): Promise<BroadcastDetail> {
  const res = await fetch(`${API_BASE}/api/broadcasts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      campaign_id: params.campaignId,
      broadcast_name: params.broadcastName.trim(),
      config_json: params.configJson,
      created_by: params.createdBy ?? "frontend-user",
    }),
  })
  if (!res.ok) await parseError(res, "Failed to save broadcast")
  const data = (await res.json()) as { broadcast: BroadcastDetail }
  return data.broadcast
}

export async function updateBroadcastApi(
  broadcastId: string,
  params: {
    broadcastName?: string
    campaignId?: string
    configJson?: CampaignDraft
    status?: EntityStatus
  }
): Promise<BroadcastDetail> {
  const res = await fetch(`${API_BASE}/api/broadcasts/${broadcastId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      broadcast_name: params.broadcastName,
      campaign_id: params.campaignId,
      config_json: params.configJson,
      status: params.status,
    }),
  })
  if (!res.ok) await parseError(res, "Failed to update broadcast")
  return (await res.json()) as BroadcastDetail
}

export async function deleteBroadcastApi(broadcastId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/broadcasts/${broadcastId}`, {
    method: "DELETE",
  })
  if (!res.ok) await parseError(res, "Failed to delete broadcast")
}

export type GenerateBroadcastResult = {
  broadcast_id: string
  output_dir: string
  generated_at: string
  files_written: string[]
  rows_assigned: number
  agent_day_slots: number
}

export async function generateBroadcastApi(
  broadcastId: string
): Promise<GenerateBroadcastResult> {
  const res = await fetch(`${API_BASE}/api/broadcasts/${broadcastId}/generate`, {
    method: "POST",
  })
  if (!res.ok) await parseError(res, "Failed to generate workbooks")
  return (await res.json()) as GenerateBroadcastResult
}

export async function duplicateBroadcastApi(broadcastId: string): Promise<BroadcastDetail> {
  const res = await fetch(`${API_BASE}/api/broadcasts/${broadcastId}/duplicate`, {
    method: "POST",
  })
  if (!res.ok) await parseError(res, "Failed to duplicate broadcast")
  const data = (await res.json()) as { broadcast: BroadcastDetail }
  return data.broadcast
}
