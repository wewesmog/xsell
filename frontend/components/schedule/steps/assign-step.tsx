"use client"

import { useEffect } from "react"
import { Controller, useFormContext } from "react-hook-form"
import type { CampaignDraft } from "@/lib/schedule/types"
import { getNumericColumns } from "@/lib/schedule/utils"
import {
  ASSIGNMENT_MODE_OPTIONS,
  assignmentModeHint,
} from "@/lib/schedule/sharing"
import { SharingPreview } from "@/components/schedule/sharing-preview"
import { Field } from "@/components/schedule/field"
import {
  SCHEDULE_SECTION_DESC_CLASS,
  SCHEDULE_SECTION_HEADER_CLASS,
  SCHEDULE_SECTION_TITLE_CLASS,
} from "@/components/schedule/schedule-headers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function AssignStep() {
  const { control, watch, setValue } = useFormContext<CampaignDraft>()
  const mode = watch("assignment.mode")
  const fairnessColumn = watch("assignment.fairnessColumn")
  const rankingEnabled = watch("ranking.enabled")
  const headers = watch("leads.headers")
  const rows = watch("leads.previewRows")
  const numeric = getNumericColumns(headers, rows)

  useEffect(() => {
    if (!rankingEnabled && mode !== "random") {
      setValue("assignment.mode", "random")
      setValue("assignment.fairnessColumn", "")
    }
  }, [rankingEnabled, mode, setValue])

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className={SCHEDULE_SECTION_HEADER_CLASS}>
          <CardTitle className={SCHEDULE_SECTION_TITLE_CLASS}>Sharing leads across agents</CardTitle>
          <CardDescription className={SCHEDULE_SECTION_DESC_CLASS}>
            Choose how leads are split across agents and campaign days
            {rankingEnabled ? " after ranking" : ""}. Without ranking, random round-robin is used.
            Agent selection, daily quota, and schedule days on later steps feed into the preview
            below.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Controller
            name="assignment.mode"
            control={control}
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value)
                  if (value === "random") {
                    setValue("assignment.fairnessColumn", "")
                  }
                }}
                className="grid gap-4"
              >
                {ASSIGNMENT_MODE_OPTIONS.map((opt) => {
                  const needsRanking = opt.value !== "random"
                  const disabled = !rankingEnabled && needsRanking
                  return (
                  <div key={opt.value} className="flex gap-3">
                    <RadioGroupItem
                      value={opt.value}
                      id={opt.id}
                      className="mt-1"
                      disabled={disabled}
                    />
                    <div className={disabled ? "opacity-50" : undefined}>
                      <Label htmlFor={opt.id}>{opt.label}</Label>
                      <p className="text-muted-foreground text-xs">
                        {assignmentModeHint(opt.value, fairnessColumn)}
                        {disabled ? " Enable ranking on the Rank step to use this mode." : ""}
                      </p>
                    </div>
                  </div>
                  )
                })}
              </RadioGroup>
            )}
          />
          {mode !== "random" ? (
            <Controller
              name="assignment.fairnessColumn"
              control={control}
              render={({ field }) => (
                <Field
                  label="Fairness column"
                  hint={
                    numeric.length > 0
                      ? "Numeric columns detected from your lead list"
                      : "Upload a list first — numeric columns appear here"
                  }
                >
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full max-w-md">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {numeric.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
          ) : null}
        </CardContent>
      </Card>

      <SharingPreview />
    </div>
  )
}
