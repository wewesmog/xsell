"use client"

import { useMemo } from "react"
import { useFormContext } from "react-hook-form"
import type { CampaignDraft } from "@/lib/schedule/types"
import {
  previewLeadSharing,
  describeAssignmentStrategy,
  describeSharingRun,
  getSharingPreviewBlockers,
} from "@/lib/schedule/sharing"
import { formatDisplayDate } from "@/lib/schedule/utils"
import { useAgentRoster } from "@/components/schedule/agent-roster-context"
import { ScheduleSectionCard } from "@/components/schedule/schedule-headers"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function SharingPreview() {
  const { watch } = useFormContext<CampaignDraft>()
  const { roster } = useAgentRoster()
  const draft = watch()
  const mode = draft.assignment.mode
  const fairnessCol = draft.assignment.fairnessColumn?.trim()

  const shares = useMemo(() => previewLeadSharing(draft, roster), [draft, roster])
  const blockers = useMemo(() => getSharingPreviewBlockers(draft), [draft])

  return (
    <ScheduleSectionCard
      title="How leads are shared"
      description={describeAssignmentStrategy(draft)}
    >
      <div className="grid gap-3">
        <p className="text-muted-foreground text-sm leading-relaxed">
          {describeSharingRun(draft)}
        </p>
        {mode !== "random" && fairnessCol ? (
          <p className="text-sm">
            Fairness column: <strong>{fairnessCol}</strong> — preview shows approximate
            sum per agent-day.
          </p>
        ) : null}
        {shares.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                {mode !== "random" && fairnessCol ? (
                  <TableHead className="text-right">Σ {fairnessCol}</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shares.map((s, i) => (
                <TableRow key={`${s.date}-${s.staffNo}-${i}`}>
                  <TableCell>{formatDisplayDate(s.date)}</TableCell>
                  <TableCell className="text-xs">
                    {s.staffNo}
                    <span className="text-muted-foreground block truncate">{s.staffName}</span>
                  </TableCell>
                  <TableCell className="text-right">{s.leadCount}</TableCell>
                  {mode !== "random" && fairnessCol ? (
                    <TableCell className="text-right">{s.fairnessSum.toLocaleString()}</TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <ul className="text-muted-foreground list-inside list-disc text-sm">
            {blockers.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        )}
      </div>
    </ScheduleSectionCard>
  )
}
