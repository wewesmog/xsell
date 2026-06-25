import type { ScheduleStepId } from "./types"

export const STORAGE_KEY = "xsell-schedule-draft-v1"

export const SCHEDULE_STEPS: {
  id: ScheduleStepId
  title: string
  description: string
}[] = [
  { id: "campaign", title: "Campaign", description: "Campaign & broadcast details" },
  { id: "leads", title: "Leads", description: "Select list & exclusions" },
  { id: "rank", title: "Rank", description: "Optional score & order" },
  { id: "assign", title: "Assign", description: "How leads are shared" },
  { id: "agents", title: "Agents", description: "Select roster for run" },
  { id: "volume", title: "Volume", description: "Daily lead quota" },
  { id: "schedule", title: "Schedule", description: "Campaign days" },
  { id: "review", title: "Review", description: "Generate workbooks" },
]
