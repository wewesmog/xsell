"use client"

import { useEffect, useState } from "react"
import { Controller, useFormContext } from "react-hook-form"
import { format } from "date-fns"
import type { CampaignDraft } from "@/lib/schedule/types"
import { countEligibleAgents, resolveScheduleDates } from "@/lib/schedule/schema"
import { formatDisplayDate } from "@/lib/schedule/utils"
import { useAgentRoster } from "@/components/schedule/agent-roster-context"
import { Field } from "@/components/schedule/field"
import {
  SCHEDULE_SECTION_DESC_CLASS,
  SCHEDULE_SECTION_HEADER_CLASS,
  SCHEDULE_SECTION_TITLE_CLASS,
} from "@/components/schedule/schedule-headers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function ScheduleDatesStep() {
  const { control, watch, setValue } = useFormContext<CampaignDraft>()
  const { roster, refresh } = useAgentRoster()
  const mode = watch("schedule.mode")
  const selectedAgents = watch("agents.selectedStaffNos")
  const specificDates = watch("schedule.specificDates")
  const [pickerOpen, setPickerOpen] = useState(false)

  const dates = resolveScheduleDates(watch())

  useEffect(() => {
    if (dates.length === 0) return
    void refresh({ from: dates[0], to: dates[dates.length - 1] })
  }, [dates.join(","), refresh])

  function addDate(iso: string) {
    if (!specificDates.includes(iso)) {
      setValue("schedule.specificDates", [...specificDates, iso].sort())
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className={SCHEDULE_SECTION_HEADER_CLASS}>
          <CardTitle className={SCHEDULE_SECTION_TITLE_CLASS}>Campaign days</CardTitle>
          <CardDescription className={SCHEDULE_SECTION_DESC_CLASS}>
            One workbook per agent per day. Absent agents are skipped automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Controller
            name="schedule.mode"
            control={control}
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                className="grid gap-3"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="range" id="sched-range" />
                  <Label htmlFor="sched-range">Start date + consecutive days</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="specific" id="sched-specific" />
                  <Label htmlFor="sched-specific">Pick specific dates</Label>
                </div>
              </RadioGroup>
            )}
          />

          {mode === "range" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Controller
                name="schedule.startDate"
                control={control}
                render={({ field }) => (
                  <Field label="Start date">
                    <Input type="date" value={field.value ?? ""} onChange={field.onChange} />
                  </Field>
                )}
              />
              <Controller
                name="schedule.numDays"
                control={control}
                render={({ field }) => (
                  <Field label="Number of days">
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={field.value ?? 1}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </Field>
                )}
              />
            </div>
          ) : (
            <div className="grid gap-3">
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger
                  render={
                    <Button type="button" variant="outline" className="w-fit">
                      <CalendarIcon className="mr-2 size-4" />
                      Add date
                    </Button>
                  }
                />
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    onSelect={(d) => {
                      if (d) {
                        addDate(format(d, "yyyy-MM-dd"))
                        setPickerOpen(false)
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
              <div className="flex flex-wrap gap-2">
                {specificDates.map((d) => (
                  <Badge key={d} variant="secondary" className="gap-1 pr-1">
                    {formatDisplayDate(d)}
                    <button
                      type="button"
                      className="hover:bg-muted ml-1 rounded px-1"
                      onClick={() =>
                        setValue(
                          "schedule.specificDates",
                          specificDates.filter((x) => x !== d)
                        )
                      }
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {dates.length > 0 ? (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-right font-medium">Eligible agents</th>
                  </tr>
                </thead>
                <tbody>
                  {dates.map((d) => {
                    const n = countEligibleAgents(d, selectedAgents, roster)
                    return (
                      <tr key={d} className="border-b last:border-0">
                        <td className="px-3 py-2">{formatDisplayDate(d)}</td>
                        <td
                          className={cn(
                            "px-3 py-2 text-right",
                            n === 0 && "text-destructive font-medium"
                          )}
                        >
                          {n}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
