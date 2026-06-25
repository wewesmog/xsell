"use client"

import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SCHEDULE_STEPS } from "@/lib/schedule/constants"
import type { ScheduleStepId } from "@/lib/schedule/types"

export function SchedulePageIntro() {
  return (
    <div className="mb-4">
      <p className="text-brand-blue mb-1 text-xs font-semibold tracking-widest uppercase">
        x-sell · Broadcasts
      </p>
      <h1 className="text-brand-blue text-3xl font-bold tracking-tight sm:text-4xl">
        Schedule broadcast
      </h1>
      <p className="text-muted-foreground mt-2 max-w-2xl text-base leading-relaxed">
        Upload leads, rank and assign fairly, then generate agent workbooks for each campaign
        day.
      </p>
    </div>
  )
}

export function ScheduleWizardNav({
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
    <div className="sticky top-14 z-20 -mx-4 mb-6 border-b border-border/60 bg-background/95 px-4 py-3 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-background/85 md:-mx-6 md:px-6 lg:mx-0 lg:rounded-lg lg:border lg:px-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="border-brand-blue/20 bg-brand-blue/[0.04] flex min-w-0 flex-1 items-center gap-3 rounded-xl border px-4 py-2.5 shadow-sm sm:max-w-md">
          <span className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-lg shadow-sm">
            <Icon className="size-5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Step {currentStep + 1} of {SCHEDULE_STEPS.length}
            </p>
            <p className="truncate text-base font-semibold leading-tight">{step.title}</p>
            <p className="text-muted-foreground truncate text-xs leading-snug">
              {step.description}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          <Button
            type="button"
            variant="outline"
            className="min-w-[88px]"
            onClick={onBack}
            disabled={!canGoBack}
          >
            Back
          </Button>
          {showContinue && !isLastStep && onContinue ? (
            <Button type="button" className="min-w-[88px]" onClick={onContinue}>
              Continue
            </Button>
          ) : null}
          {onClearDraft ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hidden h-9 text-xs sm:inline-flex"
              onClick={onClearDraft}
            >
              Start over
            </Button>
          ) : null}
        </div>
      </div>
      {onClearDraft ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground mt-2 h-8 self-end text-xs sm:hidden"
          onClick={onClearDraft}
        >
          Start over
        </Button>
      ) : null}
    </div>
  )
}

/** @deprecated Use SchedulePageIntro + ScheduleWizardNav */
export function SchedulePageHeader({
  currentStep,
  icon,
  onBack,
  onContinue,
  onClearDraft,
  canGoBack,
  showContinue,
}: {
  currentStep: number
  icon: LucideIcon
  onBack: () => void
  onContinue?: () => void
  onClearDraft?: () => void
  canGoBack?: boolean
  showContinue?: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <SchedulePageIntro />
      <ScheduleWizardNav
        currentStep={currentStep}
        icon={icon}
        onBack={onBack}
        onContinue={onContinue}
        onClearDraft={onClearDraft}
        canGoBack={canGoBack}
        showContinue={showContinue}
      />
    </div>
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
