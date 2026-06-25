"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { FormProvider, useForm } from "react-hook-form"
import type { CampaignDraft } from "@/lib/schedule/types"
import { defaultCampaignDraft } from "@/lib/schedule/defaults"
import { mergeWithDefaults } from "@/lib/schedule/storage"
import { clearXsellLocalStorage } from "@/lib/app-storage"
import { getStepWarnings } from "@/lib/schedule/schema"
import { SCHEDULE_STEPS } from "@/lib/schedule/constants"
import { fetchBroadcastById } from "@/lib/campaigns/api"
import {
  AgentRosterProvider,
  useAgentRoster,
} from "@/components/schedule/agent-roster-context"
import {
  SchedulePageIntro,
  ScheduleStepPanelHeader,
  ScheduleWizardNav,
} from "@/components/schedule/schedule-headers"
import { ScheduleStepper, SCHEDULE_STEP_ICONS } from "@/components/schedule/schedule-stepper"
import { ScheduleSummary } from "@/components/schedule/schedule-summary"
import { StepWarningsAlert } from "@/components/schedule/step-warnings-alert"
import { BroadcastStep } from "@/components/schedule/steps/broadcast-step"
import { LeadsStep } from "@/components/schedule/steps/leads-step"
import { RankStep } from "@/components/schedule/steps/rank-step"
import { AssignStep } from "@/components/schedule/steps/assign-step"
import { AgentsStep } from "@/components/schedule/steps/agents-step"
import { VolumeStep } from "@/components/schedule/steps/volume-step"
import { ScheduleDatesStep } from "@/components/schedule/steps/schedule-dates-step"
import { ReviewStep } from "@/components/schedule/steps/review-step"
import { Card, CardContent } from "@/components/ui/card"

export function ScheduleCampaignWizard() {
  return (
    <AgentRosterProvider>
      <ScheduleCampaignWizardInner />
    </AgentRosterProvider>
  )
}

function ScheduleCampaignWizardInner() {
  const searchParams = useSearchParams()
  const editBroadcastId = searchParams.get("broadcastId")
  const duplicateFromId = searchParams.get("duplicateFrom")
  const { roster } = useAgentRoster()
  const [currentStep, setCurrentStep] = useState(0)
  const [maxReached, setMaxReached] = useState(0)
  const [stepWarnings, setStepWarnings] = useState<string[]>([])
  const [draftLoaded, setDraftLoaded] = useState(false)

  const form = useForm<CampaignDraft>({
    defaultValues: defaultCampaignDraft(),
    mode: "onChange",
  })

  useEffect(() => {
    let cancelled = false

    async function init() {
      if (editBroadcastId) {
        const row = await fetchBroadcastById(editBroadcastId)
        if (cancelled || !row) {
          setDraftLoaded(true)
          return
        }
        const values = mergeWithDefaults(row.config_json)
        values.campaign.broadcastId = row.broadcast_id
        values.campaign.broadcastName = row.broadcast_name
        values.campaign.campaignId = row.campaign_id
        values.campaign.campaignName = row.campaign_name
        form.reset(values)
        setDraftLoaded(true)
        return
      }

      if (duplicateFromId) {
        const row = await fetchBroadcastById(duplicateFromId)
        if (cancelled || !row) {
          setDraftLoaded(true)
          return
        }
        const values = mergeWithDefaults(row.config_json)
        values.campaign.broadcastId = ""
        values.campaign.broadcastName = `${row.broadcast_name}_copy`
        values.campaign.campaignId = row.campaign_id
        values.campaign.campaignName = row.campaign_name
        form.reset(values)
        setDraftLoaded(true)
        return
      }

      clearXsellLocalStorage({ keepColumnLabelPresets: true })
      form.reset(defaultCampaignDraft())
      setCurrentStep(0)
      setMaxReached(0)
      setDraftLoaded(true)
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [editBroadcastId, duplicateFromId, form])

  useEffect(() => {
    if (roster.length === 0) return
    const valid = new Set(roster.map((a) => a.staffNo))
    const selected = form.getValues("agents.selectedStaffNos")
    const pruned = selected.filter((staffNo) => valid.has(staffNo))
    if (pruned.length !== selected.length) {
      form.setValue("agents.selectedStaffNos", pruned, { shouldDirty: true })
    }
  }, [roster, form])

  const goNext = useCallback(() => {
    const values = form.getValues()
    setStepWarnings(getStepWarnings(currentStep, values, roster))
    const next = Math.min(currentStep + 1, SCHEDULE_STEPS.length - 1)
    setCurrentStep(next)
    setMaxReached((m) => Math.max(m, next))
  }, [currentStep, form, roster])

  const goBack = useCallback(() => {
    setStepWarnings([])
    setCurrentStep((s) => Math.max(0, s - 1))
  }, [])

  const goToStep = useCallback((index: number) => {
    setStepWarnings([])
    setCurrentStep(index)
    setMaxReached((m) => Math.max(m, index))
  }, [])

  const resetWizard = useCallback(() => {
    clearXsellLocalStorage({ keepColumnLabelPresets: true })
    form.reset(defaultCampaignDraft())
    setCurrentStep(0)
    setMaxReached(0)
    setStepWarnings([])
  }, [form])

  const stepContent = [
    <BroadcastStep key="campaign" draftLoaded={draftLoaded} />,
    <LeadsStep key="leads" draftLoaded={draftLoaded} />,
    <RankStep key="rank" />,
    <AssignStep key="assign" />,
    <AgentsStep key="agents" />,
    <VolumeStep key="volume" />,
    <ScheduleDatesStep key="schedule" />,
    <ReviewStep key="review" onGenerated={resetWizard} />,
  ][currentStep]

  return (
    <FormProvider {...form}>
      <SchedulePageIntro />

      <div className="grid gap-6">
        <ScheduleWizardNav
          currentStep={currentStep}
          icon={SCHEDULE_STEP_ICONS[SCHEDULE_STEPS[currentStep].id]}
          onBack={goBack}
          onContinue={goNext}
          canGoBack={currentStep > 0}
          showContinue={currentStep < SCHEDULE_STEPS.length - 1}
          onClearDraft={resetWizard}
        />

        <ScheduleStepper
          currentStep={currentStep}
          maxReached={maxReached}
          onStepSelect={goToStep}
        />

        <div className="grid gap-6 pb-6 lg:grid-cols-[1fr_280px]">
          <Card className="overflow-hidden">
            <ScheduleStepPanelHeader
              stepId={SCHEDULE_STEPS[currentStep].id}
              icon={SCHEDULE_STEP_ICONS[SCHEDULE_STEPS[currentStep].id]}
            />
            <CardContent className="grid gap-4 pt-6">
              <StepWarningsAlert warnings={stepWarnings} />
              {stepContent}
            </CardContent>
          </Card>
          <ScheduleSummary />
        </div>
      </div>
    </FormProvider>
  )
}
