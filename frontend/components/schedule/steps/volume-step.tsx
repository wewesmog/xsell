"use client"

import { Controller, useFormContext } from "react-hook-form"
import type { CampaignDraft } from "@/lib/schedule/types"
import { Field } from "@/components/schedule/field"
import {
  SCHEDULE_SECTION_DESC_CLASS,
  SCHEDULE_SECTION_HEADER_CLASS,
  SCHEDULE_SECTION_TITLE_CLASS,
} from "@/components/schedule/schedule-headers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CustomWorkbookFieldsEditor } from "@/components/schedule/custom-workbook-fields"

export function VolumeStep() {
  const { control } = useFormContext<CampaignDraft>()

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className={SCHEDULE_SECTION_HEADER_CLASS}>
          <CardTitle className={SCHEDULE_SECTION_TITLE_CLASS}>Volume</CardTitle>
          <CardDescription className={SCHEDULE_SECTION_DESC_CLASS}>
            How many leads each agent receives per day. The workbook &quot;Product Name&quot;
            column is filled from your parent campaign when workbooks are generated.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid max-w-lg gap-4">
          <Controller
            name="volume.leadsPerAgentPerDay"
            control={control}
            render={({ field, fieldState }) => (
              <Field
                label="Leads per agent per day"
                hint="Typical collections run: 100–200"
                error={fieldState.error?.message}
              >
                <Input type="number" min={1} max={500} {...field} />
              </Field>
            )}
          />
          <Controller
            name="volume.internalName"
            control={control}
            render={({ field }) => (
              <Field label="Internal reference (optional)">
                <Textarea rows={2} placeholder="Campaign code or notes" {...field} />
              </Field>
            )}
          />
        </CardContent>
      </Card>

      <CustomWorkbookFieldsEditor />
    </div>
  )
}
