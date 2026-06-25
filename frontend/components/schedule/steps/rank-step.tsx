"use client"

import { useCallback, useEffect, useState } from "react"
import { Controller, useFieldArray, useFormContext } from "react-hook-form"
import type { CampaignDraft } from "@/lib/schedule/types"
import { COMPULSORY_FIELDS } from "@/lib/schedule/column-presets"
import { applyEqualWeights, getNumericColumns } from "@/lib/schedule/utils"
import { RankingPreview } from "@/components/schedule/ranking-preview"
import { Switch } from "@/components/ui/switch"
import { Field } from "@/components/schedule/field"
import {
  SCHEDULE_SECTION_DESC_CLASS,
  SCHEDULE_SECTION_HEADER_CLASS,
  SCHEDULE_SECTION_TITLE_CLASS,
} from "@/components/schedule/schedule-headers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { BarChart3Icon, PlusIcon, Trash2Icon } from "lucide-react"
import { cn } from "@/lib/utils"
import { fetchListColumns } from "@/lib/lists/api"

export function RankStep() {
  const { control, watch, setValue } = useFormContext<CampaignDraft>()
  const listId = watch("leads.fileName")
  const headers = watch("leads.headers")
  const rows = watch("leads.previewRows")
  const renames = watch("leads.columnRenames")
  const criteria = watch("ranking.criteria")
  const rankingEnabled = watch("ranking.enabled")
  const compulsoryLabels = COMPULSORY_FIELDS.map((f) => f.displayLabel)
  const displayLabels = [
    ...new Set(renames.filter((r) => r.includeInExport).map((r) => r.displayLabel)),
  ]
  const { fields, replace } = useFieldArray({
    control,
    name: "ranking.criteria",
  })

  const [numericColumns, setNumericColumns] = useState<string[]>([])
  const [columnsError, setColumnsError] = useState("")
  const [addPickerKey, setAddPickerKey] = useState(0)

  useEffect(() => {
    if (!listId) {
      setNumericColumns(getNumericColumns(headers, rows))
      return
    }

    let cancelled = false
    void fetchListColumns(listId)
      .then((payload) => {
        if (cancelled) return
        if (payload?.numeric_columns?.length) {
          setNumericColumns(payload.numeric_columns)
          setColumnsError("")
          return
        }
        setNumericColumns(getNumericColumns(headers, rows))
        setColumnsError(
          payload ? "No numeric columns detected in this list." : "Could not load list columns."
        )
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setNumericColumns(getNumericColumns(headers, rows))
        const message = error instanceof Error ? error.message : "Failed to load list columns"
        setColumnsError(message)
      })

    return () => {
      cancelled = true
    }
  }, [listId, headers, rows])

  const usedColumns = new Set(criteria.map((c) => c.column))
  const availableColumns = numericColumns.filter((col) => !usedColumns.has(col))

  const weightTotal = criteria.reduce((s, c) => s + Number(c.weight || 0), 0)

  const redistributeEqual = useCallback(
    (nextCriteria: CampaignDraft["ranking"]["criteria"]) => {
      replace(applyEqualWeights(nextCriteria))
    },
    [replace]
  )

  const addCriterion = useCallback(
    (column: string) => {
      const next = [
        ...criteria,
        { column, direction: "higher" as const, weight: 0 },
      ]
      redistributeEqual(next)
      setAddPickerKey((k) => k + 1)
    },
    [criteria, redistributeEqual]
  )

  const removeCriterion = useCallback(
    (index: number) => {
      const next = criteria.filter((_, i) => i !== index)
      if (next.length === 0) {
        replace([])
        return
      }
      redistributeEqual(next)
    },
    [criteria, redistributeEqual, replace]
  )

  return (
    <div className="grid gap-6">
      <Controller
        name="ranking.enabled"
        control={control}
        render={({ field }) => (
          <Card
            className={cn(
              "card-accent overflow-hidden border-2 transition-colors",
              field.value
                ? "border-primary/50 bg-primary/[0.07] shadow-md"
                : "border-border/80 bg-muted/20"
            )}
          >
            <CardContent className="p-0">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <span
                    className={cn(
                      "flex size-14 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-colors",
                      field.value
                        ? "border-primary/30 bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground"
                    )}
                  >
                    <BarChart3Icon className="size-7" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold tracking-tight">
                        Enable weighted ranking
                      </p>
                      <Badge variant={field.value ? "default" : "secondary"} className="text-xs">
                        {field.value ? "On" : "Off"}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {field.value
                        ? "Score leads with weighted numeric fields before assignment."
                        : "Optional — leave off to keep ingest order and use random assignment."}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border/50 pt-4 sm:border-t-0 sm:pt-0">
                  <span className="text-muted-foreground text-sm font-medium sm:hidden">
                    {field.value ? "Ranking on" : "Ranking off"}
                  </span>
                  <Switch
                    checked={field.value}
                    className="h-7 w-12 data-[size=default]:h-7 data-[size=default]:w-12 [&_[data-slot=switch-thumb]]:size-6 [&_[data-slot=switch-thumb]]:data-checked:translate-x-[calc(100%-4px)]"
                    onCheckedChange={(checked) => {
                      field.onChange(checked)
                      if (!checked) {
                        setValue("assignment.mode", "random")
                        setValue("assignment.fairnessColumn", "")
                      }
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      />

      {rankingEnabled ? (
      <Card>
        <CardHeader className={SCHEDULE_SECTION_HEADER_CLASS}>
          <CardTitle className={SCHEDULE_SECTION_TITLE_CLASS}>Weighted ranking</CardTitle>
          <CardDescription className={SCHEDULE_SECTION_DESC_CLASS}>
            Pick numeric fields from the list and assign weights (must total 100%). New fields
            default to an equal split.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {columnsError ? (
            <Alert variant="destructive">
              <AlertDescription>{columnsError}</AlertDescription>
            </Alert>
          ) : null}

          {numericColumns.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Select a lead list with numeric columns to configure ranking.
            </p>
          ) : (
            <>
              <Field
                label="Add ranking field"
                hint="Only columns verified as numeric in the stored list are shown."
              >
                <div className="flex flex-wrap gap-2">
                  <Select
                    key={addPickerKey}
                    onValueChange={(column) => {
                      if (column) addCriterion(column)
                    }}
                  >
                    <SelectTrigger className="w-full max-w-md">
                      <SelectValue placeholder="Choose numeric column" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableColumns.length === 0 ? (
                        <SelectItem value="__none__" disabled>
                          All numeric columns already added
                        </SelectItem>
                      ) : (
                        availableColumns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {availableColumns.length > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addCriterion(availableColumns[0])}
                    >
                      <PlusIcon className="mr-1 size-4" />
                      Add first available
                    </Button>
                  ) : null}
                </div>
              </Field>

              {fields.length > 0 ? (
                <div className="grid gap-3">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_180px_120px_auto]"
                    >
                      <div className="flex items-center text-sm font-medium">{field.column}</div>
                      <Controller
                        name={`ranking.criteria.${index}.direction`}
                        control={control}
                        render={({ field: directionField }) => (
                          <Select
                            value={directionField.value}
                            onValueChange={directionField.onChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="higher">Higher is better</SelectItem>
                              <SelectItem value="lower">Lower is better</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                      <Controller
                        name={`ranking.criteria.${index}.weight`}
                        control={control}
                        render={({ field: weightField }) => (
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={weightField.value}
                            onChange={weightField.onChange}
                            placeholder="Weight %"
                          />
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCriterion(index)}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-muted-foreground text-sm">
                      Total weight: {weightTotal}%
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => redistributeEqual(criteria)}
                      disabled={criteria.length === 0}
                    >
                      Distribute equally
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No ranking fields selected yet.
                </p>
              )}

              <Controller
                name="ranking.winsorize"
                control={control}
                render={({ field }) => (
                  <Field label="Outlier handling">
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="p5-p95">Winsorize at P5–P95</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
            </>
          )}
        </CardContent>
      </Card>
      ) : null}

      <Card>
        <CardHeader className={SCHEDULE_SECTION_HEADER_CLASS}>
          <CardTitle className={SCHEDULE_SECTION_TITLE_CLASS}>Agent workbook columns</CardTitle>
          <CardDescription className={SCHEDULE_SECTION_DESC_CLASS}>
            Must include Mobile Number.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Controller
            name="ranking.agentVisibleColumns"
            control={control}
            render={({ field }) => (
              <ScrollArea className="h-40 rounded-md border p-3">
                <div className="grid gap-2">
                  {displayLabels.map((label) => {
                    const locked = compulsoryLabels.includes(label)
                    const checked = field.value.includes(label) || locked
                    return (
                      <label key={label} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          disabled={locked}
                          onCheckedChange={(v) => {
                            if (locked) return
                            if (v) field.onChange([...field.value, label])
                            else field.onChange(field.value.filter((x) => x !== label))
                          }}
                        />
                        {label}
                        {locked ? (
                          <span className="text-muted-foreground text-xs">(required)</span>
                        ) : null}
                      </label>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          />
          {rankingEnabled ? (
          <Controller
            name="ranking.includeManagerColumns"
            control={control}
            render={({ field }) => (
              <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                <span className="text-sm">Include priority_score & rank (manager only)</span>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
          ) : null}
        </CardContent>
      </Card>

      <RankingPreview />
    </div>
  )
}
