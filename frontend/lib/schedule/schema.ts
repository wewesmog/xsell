import { z } from "zod"
import { SCHEDULE_STEPS } from "./constants"
import { COMPULSORY_FIELDS } from "./column-presets"
import type { RosterEntry } from "@/lib/agents/api"
import { isReservedWorkbookLabel } from "./workbook-columns"

export const columnRenameSchema = z.object({
  sourceHeader: z.string(),
  displayLabel: z.string().min(1, "Label is required"),
  includeInExport: z.boolean(),
})

export const exclusionListSchema = z.object({
  listId: z.string(),
  listName: z.string(),
  rowCount: z.number(),
})

export const criterionSchema = z.object({
  column: z.string().min(1, "Select a column"),
  direction: z.enum(["higher", "lower"]),
  weight: z.coerce.number().min(0).max(100),
})

export const customWorkbookFieldSchema = z.object({
  label: z.string().min(1, "Column label is required").max(80),
  fieldType: z.enum(["text", "dropdown", "number", "date"]),
  options: z.array(z.string().min(1)).default([]),
})

export const campaignDraftSchema = z.object({
  campaign: z.object({
    campaignId: z.string(),
    campaignName: z.string().min(1, "Select or create a campaign"),
    broadcastId: z.string(),
    broadcastName: z.string().min(1, "Broadcast name is required"),
  }),
  leads: z.object({
    fileName: z.string(),
    listName: z.string().optional(),
    headers: z.array(z.string()),
    previewRows: z.array(z.record(z.string())),
    rowCount: z.number(),
    msisdnColumn: z.string().min(1, "Select the phone column"),
    nameColumn: z.string(),
    columnRenames: z.array(columnRenameSchema),
    exclusionsEnabled: z.boolean(),
    exclusionsLookbackDays: z.coerce.number().int().min(1).max(365),
    exclusionProductNames: z.array(z.string()).default([]),
    exclusionLists: z.array(exclusionListSchema),
    poolSize: z.number(),
    excludedCount: z.number(),
  }),
  ranking: z.object({
    enabled: z.boolean(),
    criteria: z.array(criterionSchema),
    winsorize: z.enum(["none", "p5-p95"]),
    agentVisibleColumns: z
      .array(z.string())
      .min(1, "Select at least one column for agent workbooks"),
    includeManagerColumns: z.boolean(),
  }),
  assignment: z.object({
    mode: z.enum(["random", "fair", "fair_even"]),
    fairnessColumn: z.string().optional(),
  }),
  agents: z.object({
    selectedStaffNos: z.array(z.string()).min(1, "Select at least one agent"),
    useFirstN: z.boolean(),
    firstN: z.coerce.number().int().optional(),
    search: z.string().optional(),
  }),
  volume: z.object({
    leadsPerAgentPerDay: z.coerce
      .number()
      .int()
      .min(1, "Must be at least 1")
      .max(500, "Maximum 500 per agent per day"),
    internalName: z.string().optional(),
    customFields: z.array(customWorkbookFieldSchema).default([]),
  }),
  schedule: z.object({
    mode: z.enum(["range", "specific"]),
    startDate: z.string().optional(),
    numDays: z.coerce.number().int().min(1).max(31).optional(),
    specificDates: z.array(z.string()),
  }),
  review: z.object({
    acknowledgeWarnings: z.boolean(),
  }),
})

export type StepValidationResult =
  | { success: true }
  | { success: false; error: z.ZodError }

export function messagesFromValidation(result: StepValidationResult): string[] {
  if (result.success) return []
  return result.error.issues.map((i) => i.message)
}

/** Per-step checks (used for soft warnings on Continue). */
export function validateStep(
  stepIndex: number,
  data: z.infer<typeof campaignDraftSchema>,
  roster: RosterEntry[] = []
): StepValidationResult {
  switch (stepIndex) {
    case 0:
      return validateCampaignStep(data.campaign)
    case 1:
      return validateLeadsStep(data.leads)
    case 2:
      return validateRankingStep(data.ranking, data.leads)
    case 3:
      return validateAssignmentStep(data.assignment)
    case 4:
      return toStepResult(campaignDraftSchema.shape.agents.safeParse(data.agents))
    case 5:
      return validateVolumeStep(data.volume)
    case 6:
      return validateScheduleStep(data.schedule, data.agents, roster)
    case 7:
      return validateReviewStep(data, roster)
    default:
      return { success: true }
  }
}

function validateCampaignStep(
  campaign: z.infer<typeof campaignDraftSchema>["campaign"]
): StepValidationResult {
  return toStepResult(campaignDraftSchema.shape.campaign.safeParse(campaign))
}

function toStepResult(
  parsed: z.SafeParseReturnType<unknown, unknown>
): StepValidationResult {
  return parsed.success ? { success: true } : { success: false, error: parsed.error }
}

/** Soft warnings when leaving a step (does not block Continue). */
export function getStepWarnings(
  stepIndex: number,
  data: z.infer<typeof campaignDraftSchema>,
  roster: RosterEntry[] = []
): string[] {
  return messagesFromValidation(validateStep(stepIndex, data, roster))
}

/** Hard validation before Generate — all steps + capacity acknowledgement. */
export function validateForGenerate(
  data: z.infer<typeof campaignDraftSchema>,
  roster: RosterEntry[] = []
): {
  ok: boolean
  errors: string[]
} {
  const errors: string[] = []
  for (let i = 0; i < SCHEDULE_STEPS.length; i++) {
    errors.push(...messagesFromValidation(validateStep(i, data, roster)))
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)] }
}

function validateLeadsStep(
  leads: z.infer<typeof campaignDraftSchema>["leads"]
): StepValidationResult {
  const base = campaignDraftSchema.shape.leads.safeParse(leads)
  if (!base.success) return { success: false, error: base.error }

  if (leads.rowCount === 0) {
    return {
      success: false as const,
      error: new z.ZodError([
        { code: "custom", message: "Select a lead list first", path: ["fileName"] },
      ]),
    }
  }

  const msisdnRename = leads.columnRenames.find((r) => r.sourceHeader === leads.msisdnColumn)

  if (!msisdnRename?.displayLabel?.trim()) {
    return {
      success: false as const,
      error: new z.ZodError([
        { code: "custom", message: "Map the mobile number column", path: ["msisdnColumn"] },
      ]),
    }
  }
  const emptyLabel = leads.columnRenames.find((r) => !r.displayLabel.trim())
  if (emptyLabel) {
    return {
      success: false as const,
      error: new z.ZodError([
        {
          code: "custom",
          message: `Set a display label for column "${emptyLabel.sourceHeader}"`,
          path: ["columnRenames"],
        },
      ]),
    }
  }

  return { success: true }
}

function validateRankingStep(
  ranking: z.infer<typeof campaignDraftSchema>["ranking"],
  _leads: z.infer<typeof campaignDraftSchema>["leads"]
): StepValidationResult {
  const base = campaignDraftSchema.shape.ranking.safeParse(ranking)
  if (!base.success) return { success: false, error: base.error }

  const compulsoryLabels = COMPULSORY_FIELDS.map((f) => f.displayLabel)
  const missing = compulsoryLabels.filter((l) => !ranking.agentVisibleColumns.includes(l))
  if (missing.length > 0) {
    return {
      success: false as const,
      error: new z.ZodError([
        {
          code: "custom",
          message: `Agent workbooks must include: ${missing.join(", ")}`,
          path: ["agentVisibleColumns"],
        },
      ]),
    }
  }

  if (!ranking.enabled) {
    return { success: true }
  }

  if (ranking.criteria.length === 0) {
    return {
      success: false as const,
      error: new z.ZodError([
        {
          code: "custom",
          message: "Add at least one ranking field",
          path: ["criteria"],
        },
      ]),
    }
  }

  const total = ranking.criteria.reduce((s, c) => s + Number(c.weight), 0)
  if (total !== 100) {
    return {
      success: false as const,
      error: new z.ZodError([
        {
          code: "custom",
          message: `Weights must total 100% (currently ${total}%)`,
          path: ["criteria"],
        },
      ]),
    }
  }

  const duplicateColumn = ranking.criteria.find(
    (c, i) => ranking.criteria.findIndex((x) => x.column === c.column) !== i
  )
  if (duplicateColumn) {
    return {
      success: false as const,
      error: new z.ZodError([
        {
          code: "custom",
          message: `Duplicate ranking field: ${duplicateColumn.column}`,
          path: ["criteria"],
        },
      ]),
    }
  }

  return { success: true }
}

function validateAssignmentStep(
  assignment: z.infer<typeof campaignDraftSchema>["assignment"]
): StepValidationResult {
  const base = campaignDraftSchema.shape.assignment.safeParse(assignment)
  if (!base.success) return { success: false, error: base.error }
  if (
    (assignment.mode === "fair" || assignment.mode === "fair_even") &&
    !assignment.fairnessColumn?.trim()
  ) {
    return {
      success: false as const,
      error: new z.ZodError([
        {
          code: "custom",
          message: "Select a column for fair balancing / even spread",
          path: ["fairnessColumn"],
        },
      ]),
    }
  }
  return { success: true }
}

function validateVolumeStep(
  volume: z.infer<typeof campaignDraftSchema>["volume"]
): StepValidationResult {
  const base = campaignDraftSchema.shape.volume.safeParse(volume)
  if (!base.success) return { success: false, error: base.error }

  const labels = new Set<string>()
  for (let i = 0; i < volume.customFields.length; i++) {
    const field = volume.customFields[i]
    const label = field.label.trim()
    if (isReservedWorkbookLabel(label)) {
      return {
        success: false as const,
        error: new z.ZodError([
          {
            code: "custom",
            message: `"${label}" is a reserved workbook column name`,
            path: ["customFields", i, "label"],
          },
        ]),
      }
    }
    if (labels.has(label.toLowerCase())) {
      return {
        success: false as const,
        error: new z.ZodError([
          {
            code: "custom",
            message: `Duplicate custom column: ${label}`,
            path: ["customFields", i, "label"],
          },
        ]),
      }
    }
    labels.add(label.toLowerCase())
    if (field.fieldType === "dropdown" && field.options.length < 2) {
      return {
        success: false as const,
        error: new z.ZodError([
          {
            code: "custom",
            message: `Dropdown "${label}" needs at least 2 options`,
            path: ["customFields", i, "options"],
          },
        ]),
      }
    }
  }

  return { success: true }
}

function validateScheduleStep(
  schedule: z.infer<typeof campaignDraftSchema>["schedule"],
  agents: z.infer<typeof campaignDraftSchema>["agents"],
  roster: RosterEntry[] = []
): StepValidationResult {
  const dates = resolveScheduleDates(schedule)
  if (dates.length === 0) {
    return {
      success: false as const,
      error: new z.ZodError([
        {
          code: "custom",
          message: "Select at least one campaign day",
          path: ["specificDates"],
        },
      ]),
    }
  }
  const base = campaignDraftSchema.shape.schedule.safeParse(schedule)
  if (!base.success) return { success: false, error: base.error }

  const zeroDays = dates.filter(
    (d) => countEligibleAgents(d, agents.selectedStaffNos, roster) === 0
  )
  if (zeroDays.length > 0) {
    return {
      success: false as const,
      error: new z.ZodError([
        {
          code: "custom",
          message: `No eligible agents on ${zeroDays[0]}`,
          path: ["specificDates"],
        },
      ]),
    }
  }
  return { success: true }
}

function validateReviewStep(
  data: z.infer<typeof campaignDraftSchema>,
  roster: RosterEntry[] = []
): StepValidationResult {
  const warnings = getCapacityWarnings(data, roster)
  if (warnings.length > 0 && !data.review.acknowledgeWarnings) {
    return {
      success: false as const,
      error: new z.ZodError([
        {
          code: "custom",
          message: "Acknowledge capacity warnings to continue",
          path: ["acknowledgeWarnings"],
        },
      ]),
    }
  }
  return toStepResult(campaignDraftSchema.shape.review.safeParse(data.review))
}

export function resolveScheduleDates(
  schedule: z.infer<typeof campaignDraftSchema>["schedule"]
): string[] {
  if (schedule.mode === "specific") {
    return [...schedule.specificDates].sort()
  }
  if (!schedule.startDate || !schedule.numDays) return []
  const dates: string[] = []
  const start = new Date(schedule.startDate + "T12:00:00")
  for (let i = 0; i < schedule.numDays; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

export function countEligibleAgents(
  date: string,
  selected: string[],
  roster: RosterEntry[] = []
) {
  return selected.filter((staffNo) => {
    const agent = roster.find((a) => a.staffNo === staffNo)
    if (!agent?.active) return false
    return !agent.absentDates.includes(date)
  }).length
}

export function countEligibleAgentDays(
  data: z.infer<typeof campaignDraftSchema>,
  roster: RosterEntry[] = []
): number {
  const dates = resolveScheduleDates(data.schedule)
  return dates.reduce(
    (sum, date) => sum + countEligibleAgents(date, data.agents.selectedStaffNos, roster),
    0
  )
}

export function getCapacityWarnings(
  data: z.infer<typeof campaignDraftSchema>,
  roster: RosterEntry[] = []
) {
  const agentDays = countEligibleAgentDays(data, roster)
  const perDay = data.volume.leadsPerAgentPerDay
  const required = agentDays * perDay
  const available = data.leads.poolSize
  if (required > 0 && available < required) {
    return [
      `Pool has ${available.toLocaleString()} unique leads but you need ${required.toLocaleString()} (${agentDays} agent-day slot(s) × ${perDay} per day).`,
    ]
  }
  return []
}
