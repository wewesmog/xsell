"use client"

import { useMemo } from "react"
import { useFormContext } from "react-hook-form"
import type { CampaignDraft } from "@/lib/schedule/types"
import { computeRankingPreview } from "@/lib/schedule/scoring"
import { ScheduleSectionCard } from "@/components/schedule/schedule-headers"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function RankingPreview() {
  const { watch } = useFormContext<CampaignDraft>()
  const draft = watch()
  const rows = watch("leads.previewRows")

  const preview = useMemo(
    () => computeRankingPreview(rows, draft, 20),
    [rows, draft]
  )

  const description =
    rows.length === 0
      ? "Upload leads on step 1 to see top-ranked rows."
      : `Top ${preview.length} leads after scoring (from file preview rows).${
          draft.ranking.includeManagerColumns
            ? " Workbooks will also include priority_score and rank."
            : ""
        }`

  return (
    <ScheduleSectionCard title="Ranking preview" description={description}>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No preview data yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Score</TableHead>
                {Object.keys(preview[0]?.breakdown ?? {}).map((c) => (
                  <TableHead key={c} className="text-xs">
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.map((r) => (
                <TableRow key={r.rank}>
                  <TableCell>{r.rank}</TableCell>
                  <TableCell className="max-w-[120px] truncate">{r.name}</TableCell>
                  <TableCell className="font-mono text-xs">{r.msisdn}</TableCell>
                  <TableCell>{r.score}</TableCell>
                  {Object.keys(r.breakdown).map((c) => (
                    <TableCell key={c} className="text-xs">
                      {r.breakdown[c]?.toFixed(3) ?? "—"}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </ScheduleSectionCard>
  )
}
