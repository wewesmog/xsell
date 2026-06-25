"use client"

import { useCallback, useEffect, useState } from "react"
import { Controller, useFormContext } from "react-hook-form"
import { XIcon } from "lucide-react"
import type { CampaignDraft } from "@/lib/schedule/types"
import { computePoolSize } from "@/lib/schedule/utils"
import { previewExclusions, fetchExclusionCampaigns } from "@/lib/schedule/exclusions-api"
import { Checkbox } from "@/components/ui/checkbox"
import { COMPULSORY_FIELDS } from "@/lib/schedule/column-presets"
import { ColumnRenameEditor } from "@/components/schedule/column-rename-editor"
import { Field } from "@/components/schedule/field"
import { ScheduleSectionCard } from "@/components/schedule/schedule-headers"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { buildColumnRenames } from "@/lib/schedule/parse-csv"
import { ListPicker } from "@/components/lists/list-picker"
import { fetchListById, fetchListColumns, type SavedListSummary } from "@/lib/lists/api"

type ExclusionList = CampaignDraft["leads"]["exclusionLists"][number]

export function LeadsStep({ draftLoaded }: { draftLoaded: boolean }) {
  const { control, setValue, watch } = useFormContext<CampaignDraft>()
  const headers = watch("leads.headers")
  const previewRows = watch("leads.previewRows")
  const rowCount = watch("leads.rowCount")
  const selectedListId = watch("leads.fileName")
  const listName = watch("leads.listName")
  const exclusionsEnabled = watch("leads.exclusionsEnabled")
  const lookback = watch("leads.exclusionsLookbackDays")
  const exclusionProductNames = watch("leads.exclusionProductNames")
  const exclusionLists = watch("leads.exclusionLists")
  const excluded = watch("leads.excludedCount")
  const pool = watch("leads.poolSize")

  const [exclusionError, setExclusionError] = useState("")
  const [exclusionLoading, setExclusionLoading] = useState(false)
  const [oracleCampaigns, setOracleCampaigns] = useState<string[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [campaignsError, setCampaignsError] = useState("")

  const recalcExclusions = useCallback(
    (
      listId: string,
      leadRows: number,
      lists: ExclusionList[],
      enabled: boolean,
      days: number,
      productNames: string[]
    ) => {
      if (!listId || !enabled) {
        setExclusionError("")
        setValue("leads.excludedCount", 0)
        setValue("leads.poolSize", computePoolSize(leadRows, 0))
        return
      }

      setExclusionLoading(true)
      void previewExclusions({
        listId,
        exclusionsEnabled: enabled,
        lookbackDays: days,
        exclusionListIds: lists.map((l) => l.listId).filter(Boolean),
        exclusionProductNames: productNames,
      })
        .then((preview) => {
          setExclusionError(preview.oracle_error ?? "")
          setValue("leads.excludedCount", preview.excluded_count)
          setValue("leads.poolSize", preview.pool_size)
        })
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : "Exclusion preview failed"
          setExclusionError(message)
          setValue("leads.excludedCount", 0)
          setValue("leads.poolSize", computePoolSize(leadRows, 0))
        })
        .finally(() => setExclusionLoading(false))
    },
    [setValue]
  )

  useEffect(() => {
    if (!exclusionsEnabled) {
      setOracleCampaigns([])
      setCampaignsError("")
      return
    }

    let cancelled = false
    setCampaignsLoading(true)
    void fetchExclusionCampaigns(lookback)
      .then((result) => {
        if (cancelled) return
        setOracleCampaigns(result.campaigns)
        setCampaignsError(result.oracle_error ?? "")
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setOracleCampaigns([])
        setCampaignsError(
          error instanceof Error ? error.message : "Failed to load campaigns"
        )
      })
      .finally(() => {
        if (!cancelled) setCampaignsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [exclusionsEnabled, lookback])

  const applyList = useCallback(
    (selected: SavedListSummary) => {
      setValue("leads.fileName", selected.list_id)
      setValue("leads.listName", selected.list_name)
      setValue("leads.rowCount", selected.row_count_clean)
      setValue("leads.msisdnColumn", "")
      setValue("leads.nameColumn", "")
      setValue("leads.headers", [])
      setValue("leads.previewRows", [])
      setValue("leads.columnRenames", [])
      setValue("ranking.agentVisibleColumns", COMPULSORY_FIELDS.map((f) => f.displayLabel))
      setValue("ranking.criteria", [])
      recalcExclusions(
        selected.list_id,
        selected.row_count_clean,
        exclusionLists,
        exclusionsEnabled,
        lookback,
        exclusionProductNames
      )
      void fetchListColumns(selected.list_id).then((columns) => {
        if (!columns) return
        setValue("leads.headers", columns.headers)
        setValue("leads.previewRows", columns.preview_rows)
        setValue("leads.msisdnColumn", columns.msisdn_column)
        setValue("leads.nameColumn", columns.name_column)
        setValue(
          "leads.columnRenames",
          columns.headers.length > 0
            ? buildColumnRenames(columns.headers)
            : []
        )
      })
    },
    [exclusionsEnabled, exclusionLists, exclusionProductNames, lookback, recalcExclusions, setValue]
  )

  const addExclusionList = useCallback(
    (selected: SavedListSummary) => {
      if (selected.list_id === selectedListId) return
      if (exclusionLists.some((l) => l.listId === selected.list_id)) return
      const next: ExclusionList[] = [
        ...exclusionLists,
        {
          listId: selected.list_id,
          listName: selected.list_name,
          rowCount: selected.row_count_clean,
        },
      ]
      setValue("leads.exclusionLists", next)
      recalcExclusions(
        selectedListId,
        rowCount,
        next,
        exclusionsEnabled,
        lookback,
        exclusionProductNames
      )
    },
    [
      exclusionLists,
      exclusionProductNames,
      exclusionsEnabled,
      lookback,
      recalcExclusions,
      rowCount,
      selectedListId,
      setValue,
    ]
  )

  const removeExclusionList = useCallback(
    (listId: string) => {
      const next = exclusionLists.filter((l) => l.listId !== listId)
      setValue("leads.exclusionLists", next)
      recalcExclusions(
        selectedListId,
        rowCount,
        next,
        exclusionsEnabled,
        lookback,
        exclusionProductNames
      )
    },
    [exclusionLists, exclusionProductNames, exclusionsEnabled, lookback, recalcExclusions, rowCount, selectedListId, setValue]
  )

  useEffect(() => {
    if (!selectedListId) return
    const conflict = exclusionLists.some((l) => l.listId === selectedListId)
    if (!conflict) return
    const next = exclusionLists.filter((l) => l.listId !== selectedListId)
    setValue("leads.exclusionLists", next)
    recalcExclusions(
      selectedListId,
      rowCount,
      next,
      exclusionsEnabled,
      lookback,
      exclusionProductNames
    )
  }, [
    selectedListId,
    exclusionLists,
    exclusionProductNames,
    exclusionsEnabled,
    lookback,
    recalcExclusions,
    rowCount,
    setValue,
  ])

  useEffect(() => {
    if (!draftLoaded || !selectedListId || rowCount <= 0) return
    recalcExclusions(
      selectedListId,
      rowCount,
      exclusionLists,
      exclusionsEnabled,
      lookback,
      exclusionProductNames
    )
  }, [
    draftLoaded,
    selectedListId,
    rowCount,
    exclusionLists,
    exclusionProductNames,
    exclusionsEnabled,
    lookback,
    recalcExclusions,
  ])

  useEffect(() => {
    if (!draftLoaded || !selectedListId || listName) return
    void fetchListById(selectedListId).then((row) => {
      if (row) setValue("leads.listName", row.list_name)
    })
  }, [draftLoaded, selectedListId, listName, setValue])

  useEffect(() => {
    if (!draftLoaded || !selectedListId || rowCount > 0) return
    void fetchListById(selectedListId).then((row) => {
      if (row) applyList(row)
    })
  }, [draftLoaded, selectedListId, rowCount, applyList])

  useEffect(() => {
    if (!draftLoaded || exclusionLists.length === 0) return
    const needsHydration = exclusionLists.some((l) => l.listId && l.rowCount === 0)
    if (!needsHydration) return

    let cancelled = false
    void Promise.all(
      exclusionLists.map(async (entry) => {
        if (!entry.listId || entry.rowCount > 0) return entry
        const row = await fetchListById(entry.listId)
        if (!row) return entry
        return {
          listId: row.list_id,
          listName: row.list_name,
          rowCount: row.row_count_clean,
        }
      })
    ).then((hydrated) => {
      if (cancelled) return
      setValue("leads.exclusionLists", hydrated)
      recalcExclusions(
        selectedListId,
        rowCount,
        hydrated,
        exclusionsEnabled,
        lookback,
        exclusionProductNames
      )
    })

    return () => {
      cancelled = true
    }
  }, [
    draftLoaded,
    exclusionLists,
    exclusionProductNames,
    exclusionsEnabled,
    lookback,
    recalcExclusions,
    rowCount,
    setValue,
  ])

  function applyCompulsoryLabel(
    sourceHeader: string,
    displayLabel: string
  ) {
    const renames = watch("leads.columnRenames").map((r) =>
      r.sourceHeader === sourceHeader
        ? { ...r, displayLabel, includeInExport: true }
        : r
    )
    setValue("leads.columnRenames", renames)
    const visible = [
      ...new Set([
        ...COMPULSORY_FIELDS.map((f) => f.displayLabel),
        ...renames.filter((r) => r.includeInExport).map((r) => r.displayLabel),
      ]),
    ]
    setValue("ranking.agentVisibleColumns", visible)
  }

  const shouldAutoSelectLatest = draftLoaded && !selectedListId
  const excludedListIds = [
    ...(selectedListId ? [selectedListId] : []),
    ...exclusionLists.map((l) => l.listId),
  ]

  return (
    <div className="grid gap-6">
      <ScheduleSectionCard
        title="Select cleaned list"
        description="Latest list is selected by default. Search or sort to pick an older list."
      >
        <div className="grid gap-4">
          <Controller
            name="leads.fileName"
            control={control}
            render={() => (
              <Field label="Lead list">
                <ListPicker
                  value={selectedListId}
                  onSelect={applyList}
                  autoSelectLatest={shouldAutoSelectLatest}
                />
              </Field>
            )}
          />
          {rowCount > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Badge>{rowCount.toLocaleString()} rows</Badge>
              {exclusionsEnabled ? (
                <Badge variant="secondary">
                  {exclusionLoading
                    ? "Checking exclusions…"
                    : `${excluded.toLocaleString()} excluded`}
                </Badge>
              ) : null}
              <Badge variant="outline">{pool.toLocaleString()} in pool</Badge>
              {exclusionError ? (
                <p className="text-destructive w-full text-xs">{exclusionError}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </ScheduleSectionCard>

      {headers.length > 0 ? (
        <ScheduleSectionCard
          title="Compulsory field"
          description="Required before you can continue. Phone is normalized to 254 + last 9 digits on export."
        >
          <div className="grid gap-4">
            <Controller
              name="leads.msisdnColumn"
              control={control}
              render={({ field, fieldState }) => (
                <Field label="Phone column (required)" error={fieldState.error?.message}>
                  <Select
                    value={field.value}
                    onValueChange={(col) => {
                      field.onChange(col)
                      applyCompulsoryLabel(col, "Mobile Number")
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
            <Controller
              name="leads.nameColumn"
              control={control}
              render={({ field }) => (
                <Field label="Customer name column (optional)">
                  <Select
                    value={field.value}
                    onValueChange={(col) => {
                      field.onChange(col)
                      if (col) applyCompulsoryLabel(col, "Customer Name")
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select column (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
          </div>
        </ScheduleSectionCard>
      ) : null}

      {headers.length > 0 ? (
        <ScheduleSectionCard
          title="Header renaming & export columns"
          description="Map each source column to a workbook label. Use presets or add your own. Compulsory fields are always exported."
        >
          <ColumnRenameEditor />
        </ScheduleSectionCard>
      ) : null}

      <ScheduleSectionCard
        title="Exclusions"
        description="Preview uses a short-lived Oracle cache while you build the schedule. Generate always re-queries Oracle with your saved settings."
      >
        <div className="grid gap-4">
          <Controller
            name="leads.exclusionsEnabled"
            control={control}
            render={({ field }) => (
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm">Apply exclusions</span>
                <Switch
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked)
                    recalcExclusions(
                      selectedListId,
                      rowCount,
                      exclusionLists,
                      checked,
                      lookback,
                      exclusionProductNames
                    )
                  }}
                />
              </div>
            )}
          />
          {exclusionsEnabled ? (
            <>
              <Controller
                name="leads.exclusionsLookbackDays"
                control={control}
                render={({ field }) => (
                  <Field label="Oracle lookback (days)" hint="Default from admin settings: 60">
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={field.value}
                      onChange={(e) => {
                        const days = Number(e.target.value)
                        field.onChange(days)
                        recalcExclusions(
                          selectedListId,
                          rowCount,
                          exclusionLists,
                          true,
                          days,
                          exclusionProductNames
                        )
                      }}
                    />
                  </Field>
                )}
              />
              <Field
                label="Oracle campaigns (optional)"
                hint='From CONVERSIONS_FINAL "Product Name". Leave none selected to exclude across all campaigns in the lookback window.'
              >
                <div className="grid gap-2">
                  {campaignsLoading ? (
                    <p className="text-muted-foreground text-sm">Loading campaigns from Oracle…</p>
                  ) : campaignsError ? (
                    <p className="text-destructive text-sm">{campaignsError}</p>
                  ) : oracleCampaigns.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No campaigns found in the lookback window.
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-md border p-2">
                      {oracleCampaigns.map((name) => {
                        const checked = exclusionProductNames.includes(name)
                        return (
                          <label
                            key={name}
                            className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded px-1 py-1.5"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => {
                                const next = value
                                  ? [...exclusionProductNames, name]
                                  : exclusionProductNames.filter((n) => n !== name)
                                setValue("leads.exclusionProductNames", next)
                                recalcExclusions(
                                  selectedListId,
                                  rowCount,
                                  exclusionLists,
                                  true,
                                  lookback,
                                  next
                                )
                              }}
                            />
                            <span className="text-sm">{name}</span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                  {exclusionProductNames.length > 0 ? (
                    <p className="text-muted-foreground text-xs">
                      {exclusionProductNames.length} campaign(s) selected
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-xs">All campaigns in lookback</p>
                  )}
                </div>
              </Field>
              <Field
                label="Exclusion lists (optional)"
                hint="Add one or more ingested lists. Matching MSISDNs are removed from the lead pool."
              >
                <div className="grid gap-3">
                  {exclusionLists.length > 0 ? (
                    <ul className="flex flex-col gap-2">
                      {exclusionLists.map((list) => (
                        <li
                          key={list.listId}
                          className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {list.listName || list.listId}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {list.rowCount.toLocaleString()} rows
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${list.listName || list.listId}`}
                            onClick={() => removeExclusionList(list.listId)}
                          >
                            <XIcon className="size-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground text-sm">No exclusion lists added yet.</p>
                  )}
                  <ListPicker
                    value=""
                    onSelect={addExclusionList}
                    autoSelectLatest={false}
                    excludeIds={excludedListIds}
                  />
                </div>
              </Field>
            </>
          ) : null}
        </div>
      </ScheduleSectionCard>

      {previewRows.length > 0 ? (
        <ScheduleSectionCard title="Preview">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.slice(0, 6).map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, i) => (
                  <TableRow key={i}>
                    {headers.slice(0, 6).map((h) => (
                      <TableCell key={h} className="max-w-[140px] truncate">
                        {row[h]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScheduleSectionCard>
      ) : null}

    </div>
  )
}
