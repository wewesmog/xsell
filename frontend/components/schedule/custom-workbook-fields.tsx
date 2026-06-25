"use client"

import { useFieldArray, useFormContext } from "react-hook-form"
import type { CampaignDraft } from "@/lib/schedule/types"
import {
  CUSTOM_FIELD_TYPE_LABELS,
  MANDATORY_WORKBOOK_PREFIX,
  MANDATORY_WORKBOOK_SUFFIX,
  type CustomWorkbookFieldType,
} from "@/lib/schedule/workbook-columns"
import { Field } from "@/components/schedule/field"
import {
  SCHEDULE_SECTION_DESC_CLASS,
  SCHEDULE_SECTION_HEADER_CLASS,
  SCHEDULE_SECTION_TITLE_CLASS,
} from "@/components/schedule/schedule-headers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PlusIcon, Trash2Icon } from "lucide-react"

export function CustomWorkbookFieldsEditor() {
  const { control, watch, setValue } = useFormContext<CampaignDraft>()
  const { fields, append, remove } = useFieldArray({
    control,
    name: "volume.customFields",
  })

  return (
    <Card>
      <CardHeader className={SCHEDULE_SECTION_HEADER_CLASS}>
        <CardTitle className={SCHEDULE_SECTION_TITLE_CLASS}>Extra workbook columns</CardTitle>
        <CardDescription className={SCHEDULE_SECTION_DESC_CLASS}>
          Add agent-fillable columns (e.g. &quot;Bike returned&quot;). Dropdowns are created in
          Excel with your option list. Mandatory campaign columns are always included automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="text-muted-foreground rounded-md border bg-muted/30 p-3 text-xs">
          <p className="font-medium text-foreground">Always included in every workbook</p>
          <p className="mt-1">
            {MANDATORY_WORKBOOK_PREFIX.join(" · ")} · [your lead columns] · [custom below] ·{" "}
            {MANDATORY_WORKBOOK_SUFFIX.join(" · ")}
          </p>
        </div>

        {fields.length === 0 ? (
          <p className="text-muted-foreground text-sm">No custom columns yet.</p>
        ) : (
          <div className="grid gap-3">
            {fields.map((field, index) => {
              const fieldType = watch(`volume.customFields.${index}.fieldType`)
              const optionsText = (watch(`volume.customFields.${index}.options`) ?? []).join(", ")
              return (
                <div key={field.id} className="grid gap-3 rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium">Custom column {index + 1}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(index)}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                  <Field label="Column header">
                    <Input
                      placeholder="e.g. Bike returned"
                      value={watch(`volume.customFields.${index}.label`)}
                      onChange={(e) =>
                        setValue(`volume.customFields.${index}.label`, e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Input type">
                    <Select
                      value={fieldType}
                      onValueChange={(v) =>
                        setValue(
                          `volume.customFields.${index}.fieldType`,
                          v as CustomWorkbookFieldType
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(CUSTOM_FIELD_TYPE_LABELS) as CustomWorkbookFieldType[]).map(
                          (key) => (
                            <SelectItem key={key} value={key}>
                              {CUSTOM_FIELD_TYPE_LABELS[key]}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </Field>
                  {fieldType === "dropdown" ? (
                    <Field
                      label="Dropdown options"
                      hint="Comma-separated — at least 2 values"
                    >
                      <Input
                        placeholder="Yes, No, Pending"
                        value={optionsText}
                        onChange={(e) => {
                          const options = e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                          setValue(`volume.customFields.${index}.options`, options)
                        }}
                      />
                    </Field>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={() =>
            append({ label: "", fieldType: "text", options: [] })
          }
        >
          <PlusIcon className="mr-2 size-4" />
          Add column
        </Button>
      </CardContent>
    </Card>
  )
}
