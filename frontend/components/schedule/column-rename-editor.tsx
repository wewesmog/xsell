"use client"

import { useMemo, useState } from "react"
import { useFormContext } from "react-hook-form"
import type { CampaignDraft } from "@/lib/schedule/types"
import {
  COMPULSORY_FIELDS,
  describeColumnMatching,
  getAllLabelOptions,
  saveCustomLabelPreset,
  suggestDisplayLabel,
} from "@/lib/schedule/column-presets"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { PlusIcon, SparklesIcon } from "lucide-react"

const CUSTOM_OPTION_VALUE = "__custom__"

export function ColumnRenameEditor() {
  const { watch, setValue } = useFormContext<CampaignDraft>()
  const headers = watch("leads.headers")
  const renames = watch("leads.columnRenames")
  const msisdnColumn = watch("leads.msisdnColumn")
  const nameColumn = watch("leads.nameColumn")
  const [newLabel, setNewLabel] = useState("")
  const [labelOptions, setLabelOptions] = useState<string[]>(() => getAllLabelOptions())

  const refreshOptions = () => setLabelOptions(getAllLabelOptions())

  const exportLabels = useMemo(
    () => renames.filter((r) => r.includeInExport).map((r) => r.displayLabel),
    [renames]
  )

  function updateRename(
    sourceHeader: string,
    patch: Partial<{ displayLabel: string; includeInExport: boolean }>
  ) {
    const next = renames.map((r) =>
      r.sourceHeader === sourceHeader ? { ...r, ...patch } : r
    )
    setValue("leads.columnRenames", next)
    if (patch.displayLabel !== undefined || patch.includeInExport !== undefined) {
      syncAgentVisibleColumns(next)
    }
  }

  function syncAgentVisibleColumns(updated: typeof renames) {
    const labels = updated.filter((r) => r.includeInExport).map((r) => r.displayLabel)
    const compulsory = COMPULSORY_FIELDS.map((f) => f.displayLabel)
    setValue("ranking.agentVisibleColumns", [...new Set([...compulsory, ...labels])])
  }

  function applyAllPresets() {
    const next = headers.map((h) => ({
      sourceHeader: h,
      displayLabel: suggestDisplayLabel(h),
      includeInExport: true,
    }))
    setValue("leads.columnRenames", next)
    syncAgentVisibleColumns(next)
  }

  function addCustomLabel() {
    const trimmed = newLabel.trim()
    if (!trimmed) return
    saveCustomLabelPreset(trimmed)
    refreshOptions()
    setNewLabel("")
  }

  if (headers.length === 0) return null

  return (
    <div className="grid gap-4">
      <Alert>
        <AlertDescription className="text-xs">{describeColumnMatching()}</AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={applyAllPresets}>
          <SparklesIcon className="mr-1 size-4" />
          Apply all presets
        </Button>
        <span className="text-muted-foreground text-xs">
          {exportLabels.length} columns marked for export
        </span>
      </div>

      <ScrollArea className="h-[min(360px,50vh)] rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source column</TableHead>
              <TableHead>Display label (workbook header)</TableHead>
              <TableHead className="w-24 text-center">Export</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {renames.map((row) => {
              const isCompulsory = row.sourceHeader === msisdnColumn
              const suggested = suggestDisplayLabel(row.sourceHeader)
              return (
                <TableRow key={row.sourceHeader}>
                  <TableCell className="font-mono text-xs">
                    <div>{row.sourceHeader}</div>
                    {suggested !== row.sourceHeader && suggested !== row.displayLabel ? (
                      <span className="text-muted-foreground mt-0.5 block text-[10px]">
                        Suggested: {suggested}
                      </span>
                    ) : null}
                    {row.sourceHeader === msisdnColumn ? (
                      <Badge className="ml-0 mt-1" variant="default">
                        MSISDN
                      </Badge>
                    ) : null}
                    {row.sourceHeader === nameColumn ? (
                      <Badge className="ml-0 mt-1" variant="secondary">
                        Name
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={
                        labelOptions.includes(row.displayLabel)
                          ? row.displayLabel
                          : CUSTOM_OPTION_VALUE
                      }
                      onValueChange={(v) => {
                        if (v === CUSTOM_OPTION_VALUE) {
                          const typed = window
                            .prompt("Enter custom label", row.displayLabel)
                            ?.trim()
                          if (typed) updateRename(row.sourceHeader, { displayLabel: typed })
                          return
                        }
                        updateRename(row.sourceHeader, { displayLabel: v })
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pick label" />
                      </SelectTrigger>
                      <SelectContent>
                        {labelOptions.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_OPTION_VALUE}>
                          {labelOptions.includes(row.displayLabel)
                            ? "Custom..."
                            : `Custom: ${row.displayLabel}`}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={row.includeInExport}
                      disabled={isCompulsory}
                      onCheckedChange={(v) =>
                        updateRename(row.sourceHeader, { includeInExport: Boolean(v) })
                      }
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </ScrollArea>

      <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
        <div className="grid flex-1 gap-1">
          <label className="text-sm font-medium">Save a new label to the preset list</label>
          <Input
            placeholder="e.g. Days Since Last Login"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
        </div>
        <Button type="button" variant="secondary" onClick={addCustomLabel}>
          <PlusIcon className="mr-1 size-4" />
          Save preset
        </Button>
      </div>
    </div>
  )
}
