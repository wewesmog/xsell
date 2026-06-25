"use client"

import { useState } from "react"
import { Controller, useFormContext } from "react-hook-form"
import type { CampaignDraft } from "@/lib/schedule/types"
import { getCapacityWarnings, validateForGenerate } from "@/lib/schedule/schema"
import {
  createBroadcastApi,
  generateBroadcastApi,
  updateBroadcastApi,
} from "@/lib/campaigns/api"
import { clearXsellLocalStorage } from "@/lib/app-storage"
import { useAgentRoster } from "@/components/schedule/agent-roster-context"
import { GenerateErrorsAlert } from "@/components/schedule/step-warnings-alert"
import { summarizeDraft, getAgentLabel, formatDisplayDate } from "@/lib/schedule/utils"
import { formatAssignmentSummary } from "@/lib/schedule/sharing"
import {
  SCHEDULE_SECTION_DESC_CLASS,
  SCHEDULE_SECTION_HEADER_CLASS,
  SCHEDULE_SECTION_TITLE_CLASS,
} from "@/components/schedule/schedule-headers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

type Props = {
  onSaved?: (broadcastId: string) => void
  onGenerated?: () => void
}

export function ReviewStep({ onSaved, onGenerated }: Props) {
  const { control, getValues, setValue } = useFormContext<CampaignDraft>()
  const { roster } = useAgentRoster()
  const data = getValues()
  const summary = summarizeDraft(data, roster)
  const warnings = getCapacityWarnings(data, roster)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(data.campaign.broadcastId || null)
  const [generateResult, setGenerateResult] = useState<string | null>(null)
  const [saveErrors, setSaveErrors] = useState<string[]>([])

  async function persistBroadcast(): Promise<string> {
    const check = validateForGenerate(getValues(), roster)
    if (!check.ok) {
      setSaveErrors(check.errors)
      throw new Error("validation")
    }
    setSaveErrors([])
    const draft = getValues()
    const existingId = draft.campaign.broadcastId
    const saved = existingId
      ? await updateBroadcastApi(existingId, {
          broadcastName: draft.campaign.broadcastName,
          campaignId: draft.campaign.campaignId,
          configJson: draft,
        })
      : await createBroadcastApi({
          campaignId: draft.campaign.campaignId,
          broadcastName: draft.campaign.broadcastName,
          configJson: draft,
        })
    setValue("campaign.broadcastId", saved.broadcast_id)
    setSavedId(saved.broadcast_id)
    onSaved?.(saved.broadcast_id)
    return saved.broadcast_id
  }

  async function saveOnly() {
    setSaving(true)
    try {
      await persistBroadcast()
      setGenerateResult(null)
    } catch (error) {
      if (error instanceof Error && error.message !== "validation") {
        setSaveErrors([error.message])
      }
    } finally {
      setSaving(false)
    }
  }

  async function saveAndGenerate() {
    setGenerating(true)
    try {
      const id = await persistBroadcast()
      const result = await generateBroadcastApi(id)
      clearXsellLocalStorage({ keepColumnLabelPresets: true })
      onGenerated?.()
      setGenerateResult(
        `Generated ${result.rows_assigned.toLocaleString()} rows → ${result.output_dir}`
      )
    } catch (error) {
      if (error instanceof Error && error.message !== "validation") {
        setSaveErrors([error.message])
      }
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className={SCHEDULE_SECTION_HEADER_CLASS}>
          <CardTitle className={SCHEDULE_SECTION_TITLE_CLASS}>Review & generate</CardTitle>
          <CardDescription className={SCHEDULE_SECTION_DESC_CLASS}>
            Save this broadcast, then generate workbooks via{" "}
            <code className="text-xs">POST /api/broadcasts/&#123;id&#125;/generate</code> (Save &
            generate below, or Generate from the campaigns list).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          <Section title="Campaign / broadcast">
            <p>
              {data.campaign.campaignName || "No campaign selected"} ·{" "}
              {data.campaign.broadcastName || "No broadcast name"}
            </p>
            <p className="text-muted-foreground text-xs">
              {summary.dates.length} day(s) in this run
            </p>
          </Section>
          <Separator />
          <Section title="Leads">
            <p>
              {data.leads.listName || data.leads.fileName || "No list"} —{" "}
              {data.leads.poolSize.toLocaleString()} in pool
              {data.leads.exclusionsEnabled
                ? ` (${data.leads.excludedCount.toLocaleString()} excluded, ${data.leads.exclusionsLookbackDays}d lookback)`
                : ""}
            </p>
          </Section>
          <Separator />
          <Section title="Ranking">
            <p>
              {!data.ranking.enabled
                ? "Disabled — leads keep ingest order"
                : data.ranking.criteria.length > 0
                  ? data.ranking.criteria
                      .map((c) => `${c.column} ${c.weight}%`)
                      .join(" · ")
                  : "Enabled but no ranking fields configured"}
            </p>
          </Section>
          <Separator />
          <Section title="Sharing / assignment">
            <p>{formatAssignmentSummary(data.assignment)}</p>
          </Section>
          <Separator />
          <Section title="Agents">
            <p>{data.agents.selectedStaffNos.length} agents</p>
            <ul className="text-muted-foreground mt-1 list-inside list-disc">
              {data.agents.selectedStaffNos.slice(0, 5).map((s) => (
                <li key={s}>{getAgentLabel(s, roster)}</li>
              ))}
            </ul>
          </Section>
          <Separator />
          <Section title="Volume">
            <p>{data.volume.leadsPerAgentPerDay} leads/agent/day</p>
            <p className="text-muted-foreground text-xs">
              Workbook product name: {data.campaign.campaignName || "—"} (from parent campaign)
            </p>
          </Section>
          <Separator />
          <Section title="Schedule days">
            <div className="flex flex-wrap gap-1">
              {summary.dates.map((d) => (
                <Badge key={d} variant="outline">
                  {formatDisplayDate(d)}
                </Badge>
              ))}
            </div>
          </Section>
        </CardContent>
      </Card>

      {warnings.length > 0 ? (
        <Alert>
          <AlertTitle>Capacity warning</AlertTitle>
          <AlertDescription>{warnings[0]}</AlertDescription>
        </Alert>
      ) : null}

      {warnings.length > 0 ? (
        <Controller
          name="review.acknowledgeWarnings"
          control={control}
          render={({ field }) => (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={field.value}
                onCheckedChange={(v) => field.onChange(Boolean(v))}
              />
              I understand the pool may not fill all agent-day slots
            </label>
          )}
        />
      ) : null}

      {savedId ? (
        <Alert>
          <AlertTitle>Broadcast saved</AlertTitle>
          <AlertDescription>
            Schedule stored. You can generate workbooks now or from the campaigns list.
          </AlertDescription>
        </Alert>
      ) : null}

      {generateResult ? (
        <Alert>
          <AlertTitle>Workbooks generated</AlertTitle>
          <AlertDescription>{generateResult}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void saveOnly()}
          disabled={saving || generating}
        >
          {saving ? "Saving…" : savedId ? "Update broadcast" : "Save for later"}
        </Button>
        <Button type="button" onClick={() => void saveAndGenerate()} disabled={saving || generating}>
          {generating ? "Generating…" : "Save & generate workbooks"}
        </Button>
      </div>

      <GenerateErrorsAlert errors={saveErrors} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-base font-semibold tracking-tight">{title}</p>
      {children}
    </div>
  )
}
