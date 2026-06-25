"use client"

import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SCHEDULE_STEPS } from "@/lib/schedule/constants"
import type { ScheduleStepId } from "@/lib/schedule/types"

export function SchedulePageHeader({
  currentStep,
  icon: Icon,
  onBack,
  onContinue,
  onClearDraft,
  canGoBack = true,
  showContinue = true,
}: {
  currentStep: number
  icon: LucideIcon
  onBack: () => void
  onContinue?: () => void
  onClearDraft?: () => void
  canGoBack?: boolean
  showContinue?: boolean
}) {
  const step = SCHEDULE_STEPS[currentStep]
  const isLastStep = currentStep >= SCHEDULE_STEPS.length - 1

  return (
    <header className="flex flex-col gap-4 border-b border-border/60 pb-6 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p className="text-brand-blue mb-1 text-xs font-semibold tracking-widest uppercase">
          x-sell · Campaign
        </p>
        <h1 className="text-brand-blue text-3xl font-bold tracking-tight sm:text-4xl">
          Schedule campaign
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-base leading-relaxed">
          Upload leads, rank and assign fairly, then generate agent workbooks for each campaign
          day.
        </p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:w-auto lg:min-w-[340px] lg:items-end">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-stretch">
          <div className="border-brand-blue/20 bg-brand-blue/[0.04] flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 shadow-sm">
            <span className="bg-primary text-primary-foreground flex size-11 shrink-0 items-center justify-center rounded-lg shadow-sm">
              <Icon className="size-5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                Step {currentStep + 1} of {SCHEDULE_STEPS.length}
              </p>
              <p className="text-lg font-semibold leading-tight">{step.title}</p>
              <p className="text-muted-foreground text-xs leading-snug">{step.description}</p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2 sm:flex-col sm:justify-center">
            <Button
              type="button"
              variant="outline"
              className="min-w-[88px] flex-1 sm:flex-none"
              onClick={onBack}
              disabled={!canGoBack}
            >
              Back
            </Button>
            {showContinue && !isLastStep && onContinue ? (
              <Button
                type="button"
                className="min-w-[88px] flex-1 sm:flex-none"
                onClick={onContinue}
              >
                Continue
              </Button>
            ) : null}
          </div>
        </div>
        {onClearDraft ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-8 self-end text-xs"
            onClick={onClearDraft}
          >
            Start over
          </Button>
        ) : null}
      </div>
    </header>
  )
}

export function ScheduleStepPanelHeader({
  stepId,
  icon: Icon,
}: {
  stepId: ScheduleStepId
  icon: LucideIcon
}) {
  const step = SCHEDULE_STEPS.find((s) => s.id === stepId)!
  const index = SCHEDULE_STEPS.findIndex((s) => s.id === stepId)

  return (
    <CardHeader className="gap-3 border-b border-border/60 bg-muted/25 [.border-b]:pb-5">
      <div className="flex items-start gap-4">
        <span className="bg-background text-brand-blue flex size-12 shrink-0 items-center justify-center rounded-xl border shadow-sm">
          <Icon className="size-6" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Step {index + 1} · {step.title}
          </p>
          <CardTitle className="text-xl font-bold tracking-tight sm:text-2xl">
            {step.title}
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            {step.description}
          </CardDescription>
        </div>
      </div>
    </CardHeader>
  )
}

/** Prominent header inside nested section cards. */
export function ScheduleSectionHeader({
  title,
  description,
  className,
  action,
}: {
  title: string
  description?: string
  className?: string
  action?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border/50 pb-4 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="space-y-1">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
        {description ? (
          <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/** Section card with a prominent header block. */
/** Use on nested CardHeader blocks for consistent section styling. */
export const SCHEDULE_SECTION_HEADER_CLASS =
  "gap-2 border-b border-border/50 bg-muted/20 [.border-b]:pb-4"
export const SCHEDULE_SECTION_TITLE_CLASS = "text-lg font-semibold tracking-tight"
export const SCHEDULE_SECTION_DESC_CLASS = "text-sm leading-relaxed"

export function ScheduleSectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn("card-accent", className)}>
      <CardHeader className="pb-2">
        <ScheduleSectionHeader title={title} description={description} action={action} />
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
