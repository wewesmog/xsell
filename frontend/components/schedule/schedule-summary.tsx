"use client"

import { useFormContext, useWatch } from "react-hook-form"
import type { CampaignDraft } from "@/lib/schedule/types"
import { mergeWithDefaults } from "@/lib/schedule/storage"
import { useAgentRoster } from "@/components/schedule/agent-roster-context"
import { summarizeDraft } from "@/lib/schedule/utils"
import { resolveScheduleDates } from "@/lib/schedule/schema"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDisplayDate } from "@/lib/schedule/utils"

export function ScheduleSummary() {
  const { control } = useFormContext<CampaignDraft>()
  const { roster } = useAgentRoster()
  const watched = useWatch({ control })
  const values = mergeWithDefaults((watched ?? {}) as Partial<CampaignDraft>)
  const summary = summarizeDraft(values, roster)
  const dates = resolveScheduleDates(values.schedule)

  return (
    <Card className="sticky top-4">
      <CardHeader className="border-b border-border/50 bg-muted/25 pb-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Live totals
        </p>
        <CardTitle className="text-xl font-bold tracking-tight">Run summary</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <Row
          label="Campaign"
          value={values.campaign.campaignName || "Not selected"}
        />
        <Row
          label="Broadcast"
          value={values.campaign.broadcastName || "Not set"}
        />
        <Row label="Leads in pool" value={summary.pool.toLocaleString()} />
        <Row label="Agents selected" value={String(summary.agentCount)} />
        <Row label="Eligible agent-days" value={String(summary.agentDays)} />
        <Row label="Per agent / day" value={String(summary.perDay)} />
        <Row label="Campaign days" value={String(summary.dates.length)} />
        <Row label="Total slots" value={summary.required.toLocaleString()} />
        <Row
          label="Gap"
          value={
            summary.gap >= 0
              ? `+${summary.gap.toLocaleString()} spare`
              : `${Math.abs(summary.gap).toLocaleString()} short`
          }
          highlight={summary.gap < 0 ? "destructive" : "default"}
        />
        {dates.length > 0 ? (
          <div className="flex flex-wrap gap-1 pt-1">
            {dates.map((d) => (
              <Badge key={d} variant="secondary">
                {formatDisplayDate(d)}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: "destructive" | "default"
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          highlight === "destructive" ? "text-destructive font-medium" : "font-medium"
        }
      >
        {value}
      </span>
    </div>
  )
}
