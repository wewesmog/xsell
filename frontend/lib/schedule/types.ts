import { z } from "zod"
import {
  campaignDraftSchema,
  criterionSchema,
  columnRenameSchema,
} from "./schema"

export type CampaignDraft = z.infer<typeof campaignDraftSchema>
export type RankingCriterion = z.infer<typeof criterionSchema>
export type ColumnRename = z.infer<typeof columnRenameSchema>

export type ScheduleStepId =
  | "campaign"
  | "leads"
  | "rank"
  | "assign"
  | "agents"
  | "volume"
  | "schedule"
  | "review"

export type StoredDraft = {
  savedAt: string
  currentStep: number
  values: CampaignDraft
}
