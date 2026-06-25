import type { CampaignDraft, RankingCriterion } from "./types"

function parseNum(v: string | undefined): number {
  if (v == null || v === "") return NaN
  return Number(String(v).replace(/,/g, ""))
}

function winsorize(values: number[], mode: "none" | "p5-p95"): number[] {
  if (mode === "none" || values.length < 5) return values
  const sorted = [...values].sort((a, b) => a - b)
  const p5 = sorted[Math.floor(sorted.length * 0.05)]
  const p95 = sorted[Math.floor(sorted.length * 0.95)]
  return values.map((v) => Math.min(p95, Math.max(p5, v)))
}

function minMaxNorm(values: number[], direction: "higher" | "lower"): number[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max === min) return values.map(() => 0.5)
  return values.map((v) => {
    const x = (v - min) / (max - min)
    return direction === "higher" ? x : 1 - x
  })
}

export type RankedPreviewRow = {
  rank: number
  msisdn: string
  name: string
  score: number
  breakdown: Record<string, number>
}

export function computeRankingPreview(
  rows: Record<string, string>[],
  draft: CampaignDraft,
  limit = 20
): RankedPreviewRow[] {
  if (rows.length === 0) return []

  const { ranking, leads } = draft
  const msisdnCol = leads.msisdnColumn
  const nameCol = leads.nameColumn
  const criteria = ranking.criteria

  if (criteria.length === 0) return []

  const partials: number[][] = criteria.map(() => [])

  criteria.forEach((c: RankingCriterion, j) => {
    const raw = rows.map((r) => parseNum(r[c.column]))
    const w = winsorize(
      raw.map((v) => (Number.isNaN(v) ? 0 : v)),
      ranking.winsorize
    )
    const norm = minMaxNorm(w, c.direction)
    partials[j] = norm
  })

  const scores = rows.map((row, i) => {
    let total = 0
    const breakdown: Record<string, number> = {}
    criteria.forEach((c, j) => {
      const part = (partials[j][i] ?? 0) * (c.weight / 100)
      breakdown[c.column] = part
      total += part
    })
    return { row, score: total, breakdown }
  })
  scores.sort((a, b) => b.score - a.score)

  return scores.slice(0, limit).map((s, idx) => ({
    rank: idx + 1,
    msisdn: s.row[msisdnCol] ?? "",
    name: nameCol ? (s.row[nameCol] ?? "") : "",
    score: Math.round(s.score * 1000) / 1000,
    breakdown: s.breakdown,
  }))
}
