"use client"

import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  Megaphone,
  CalendarDays,
  CheckIcon,
  FileSpreadsheet,
  Gauge,
  Share2,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SCHEDULE_STEPS } from "@/lib/schedule/constants"
import type { ScheduleStepId } from "@/lib/schedule/types"

export const SCHEDULE_STEP_ICONS: Record<ScheduleStepId, LucideIcon> = {
  campaign: Megaphone,
  leads: FileSpreadsheet,
  rank: BarChart3,
  assign: Share2,
  agents: Users,
  volume: Gauge,
  schedule: CalendarDays,
  review: CheckIcon,
}

export function ScheduleStepper({
  currentStep,
  maxReached,
  onStepSelect,
}: {
  currentStep: number
  maxReached: number
  onStepSelect?: (index: number) => void
}) {
  return (
    <nav aria-label="Campaign schedule steps">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        {SCHEDULE_STEPS.map((step, index) => {
          const done = index < currentStep
          const active = index === currentStep
          const reachable = index <= maxReached
          const Icon = SCHEDULE_STEP_ICONS[step.id]

          return (
            <li key={step.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onStepSelect?.(index)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "group relative flex h-full w-full flex-col items-start gap-2 rounded-lg border bg-card p-3 text-left shadow-sm transition-all",
                  "hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active &&
                    "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md",
                  done && !active && "border-primary/30 bg-muted/30",
                  !reachable && "cursor-not-allowed opacity-45 hover:shadow-sm",
                  reachable && !active && onStepSelect && "hover:border-primary/40"
                )}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-md transition-colors",
                      active && "bg-primary text-primary-foreground",
                      done && !active && "bg-primary/15 text-primary",
                      !done && !active && "bg-muted text-muted-foreground"
                    )}
                  >
                    {done && !active ? (
                      <CheckIcon className="size-4" strokeWidth={2.5} />
                    ) : (
                      <Icon className="size-4" strokeWidth={2} />
                    )}
                  </span>
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {index + 1}
                  </span>
                </div>

                <div className="w-full space-y-0.5">
                  <span
                    className={cn(
                      "block text-sm leading-tight font-bold",
                      active && "text-foreground"
                    )}
                  >
                    {step.title}
                  </span>
                  <span className="text-muted-foreground line-clamp-2 text-[11px] leading-snug">
                    {step.description}
                  </span>
                </div>

                {active ? (
                  <span className="bg-primary absolute bottom-0 left-3 right-3 h-0.5 rounded-full" />
                ) : null}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
