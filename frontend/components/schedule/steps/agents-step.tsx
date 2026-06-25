"use client"

import { Controller, useFormContext } from "react-hook-form"
import type { CampaignDraft } from "@/lib/schedule/types"
import { useAgentRoster } from "@/components/schedule/agent-roster-context"
import { Field } from "@/components/schedule/field"
import {
  SCHEDULE_SECTION_DESC_CLASS,
  SCHEDULE_SECTION_HEADER_CLASS,
  SCHEDULE_SECTION_TITLE_CLASS,
} from "@/components/schedule/schedule-headers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function AgentsStep() {
  const { control, watch, setValue } = useFormContext<CampaignDraft>()
  const { roster, loading, error } = useAgentRoster()
  const search = (watch("agents.search") ?? "").toLowerCase()
  const selected = watch("agents.selectedStaffNos")
  const useFirstN = watch("agents.useFirstN")
  const firstN = watch("agents.firstN") ?? 25

  const filtered = roster.filter(
    (a) =>
      a.staffName.toLowerCase().includes(search) ||
      a.staffNo.toLowerCase().includes(search)
  )

  function toggle(staffNo: string, on: boolean) {
    if (on) setValue("agents.selectedStaffNos", [...selected, staffNo])
    else setValue("agents.selectedStaffNos", selected.filter((s) => s !== staffNo))
  }

  function selectAll() {
    setValue(
      "agents.selectedStaffNos",
      filtered.filter((a) => a.active).map((a) => a.staffNo)
    )
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className={SCHEDULE_SECTION_HEADER_CLASS}>
          <CardTitle className={SCHEDULE_SECTION_TITLE_CLASS}>Select agents</CardTitle>
          <CardDescription className={SCHEDULE_SECTION_DESC_CLASS}>
            Active roster from admin. Absences reduce capacity on schedule step.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Could not load agents</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Controller
            name="agents.search"
            control={control}
            render={({ field }) => (
              <Input placeholder="Search by name or staff number…" {...field} />
            )}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="text-primary text-sm underline-offset-4 hover:underline"
              onClick={selectAll}
              disabled={loading}
            >
              Select all visible
            </button>
            <button
              type="button"
              className="text-muted-foreground text-sm underline-offset-4 hover:underline"
              onClick={() => setValue("agents.selectedStaffNos", [])}
            >
              Clear
            </button>
            <Badge variant="secondary">{selected.length} selected</Badge>
          </div>
          <ScrollArea className="h-64 rounded-md border">
            <div className="grid gap-1 p-2">
              {loading ? (
                <p className="text-muted-foreground p-2 text-sm">Loading agents…</p>
              ) : filtered.length === 0 ? (
                <p className="text-muted-foreground p-2 text-sm">
                  No agents in admin roster. Add agents under Admin → Agents.
                </p>
              ) : (
                filtered.map((agent) => {
                  const checked = selected.includes(agent.staffNo)
                  return (
                    <label
                      key={agent.staffNo}
                      className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-md px-2 py-2"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={!agent.active}
                        onCheckedChange={(v) => toggle(agent.staffNo, Boolean(v))}
                      />
                      <span className="flex-1 text-sm">
                        <span className="font-medium">{agent.staffNo}</span>
                        <span className="text-muted-foreground"> — {agent.staffName}</span>
                      </span>
                      {!agent.active ? (
                        <Badge variant="secondary" className="text-xs">
                          inactive
                        </Badge>
                      ) : null}
                      {agent.absentDates.length > 0 ? (
                        <Badge variant="outline" className="text-xs">
                          Absent {agent.absentDates[0]}
                        </Badge>
                      ) : null}
                    </label>
                  )
                })
              )}
            </div>
          </ScrollArea>
          <Controller
            name="agents.useFirstN"
            control={control}
            render={({ field }) => (
              <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Use first N agents only</p>
                  <p className="text-muted-foreground text-xs">
                    Matches notebook behaviour when testing with a subset
                  </p>
                </div>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
          {useFirstN ? (
            <Controller
              name="agents.firstN"
              control={control}
              render={({ field }) => (
                <Field label="N agents">
                  <Input
                    type="number"
                    min={1}
                    max={roster.length || 1}
                    value={field.value}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      field.onChange(n)
                      setValue(
                        "agents.selectedStaffNos",
                        roster.slice(0, n).map((a) => a.staffNo)
                      )
                    }}
                  />
                </Field>
              )}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
