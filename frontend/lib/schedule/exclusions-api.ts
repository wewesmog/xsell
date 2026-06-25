const API_BASE = process.env.NEXT_PUBLIC_XSELL_API_BASE_URL ?? "http://localhost:8000"

export type ExclusionPreview = {
  list_id: string
  lead_row_count: number
  exclusions_enabled: boolean
  lookback_days: number
  exclusion_list_ids: string[]
  exclusion_product_names: string[]
  oracle_available: boolean
  oracle_error: string | null
  oracle_exclusion_total: number
  oracle_overlap: number
  list_overlap: number
  excluded_count: number
  pool_size: number
}

export type ExclusionCampaigns = {
  lookback_days: number
  campaigns: string[]
  oracle_available: boolean
  oracle_error: string | null
}

export async function fetchExclusionCampaigns(
  lookbackDays: number
): Promise<ExclusionCampaigns> {
  const res = await fetch(
    `${API_BASE}/api/exclusions/campaigns?lookback_days=${lookbackDays}`
  )
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || "Failed to load campaigns")
  }
  return (await res.json()) as ExclusionCampaigns
}

export async function previewExclusions(params: {
  listId: string
  exclusionsEnabled: boolean
  lookbackDays: number
  exclusionListIds: string[]
  exclusionProductNames: string[]
}): Promise<ExclusionPreview> {
  const res = await fetch(`${API_BASE}/api/exclusions/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      list_id: params.listId,
      exclusions_enabled: params.exclusionsEnabled,
      lookback_days: params.lookbackDays,
      exclusion_list_ids: params.exclusionListIds,
      exclusion_product_names: params.exclusionProductNames,
    }),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || "Exclusion preview failed")
  }
  return (await res.json()) as ExclusionPreview
}
