"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Controller, useFormContext } from "react-hook-form"
import type { CampaignDraft } from "@/lib/schedule/types"
import { fetchCampaignById, fetchCampaigns, type CampaignSummary } from "@/lib/campaigns/api"
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

type Props = {
  draftLoaded: boolean
}

export function BroadcastStep({ draftLoaded }: Props) {
  const { control, setValue, watch } = useFormContext<CampaignDraft>()
  const selectedCampaignId = watch("campaign.campaignId")
  const selectedCampaignName = watch("campaign.campaignName")
  const broadcastId = watch("campaign.broadcastId")
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  const loadCampaigns = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchCampaigns()
      setCampaigns(rows.filter((c) => c.status === "active"))
      setLoadError("")
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load campaigns")
      setCampaigns([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCampaigns()
  }, [loadCampaigns])

  useEffect(() => {
    if (!draftLoaded || !selectedCampaignId || selectedCampaignName) return
    void fetchCampaignById(selectedCampaignId).then((row) => {
      if (row) setValue("campaign.campaignName", row.campaign_name)
    })
  }, [draftLoaded, selectedCampaignId, selectedCampaignName, setValue])

  function onPickCampaign(campaignId: string) {
    const picked = campaigns.find((c) => c.campaign_id === campaignId)
    setValue("campaign.campaignId", campaignId)
    setValue("campaign.campaignName", picked?.campaign_name ?? "")
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className={SCHEDULE_SECTION_HEADER_CLASS}>
          <CardTitle className={SCHEDULE_SECTION_TITLE_CLASS}>
            {broadcastId ? "Broadcast name" : "Create a broadcast"}
          </CardTitle>
          <CardDescription className={SCHEDULE_SECTION_DESC_CLASS}>
            Give this run a clear name, then choose the parent campaign it belongs to.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Controller
            name="campaign.broadcastName"
            control={control}
            render={({ field, fieldState }) => (
              <Field
                label="Broadcast name"
                error={fieldState.error?.message}
                hint="Shown in the campaigns list and on generated workbooks."
              >
                <Input
                  placeholder="e.g. Week 4 Collections - Branch A"
                  autoFocus={!broadcastId}
                  {...field}
                />
              </Field>
            )}
          />

          {loadError ? <p className="text-destructive text-sm">{loadError}</p> : null}

          <Controller
            name="campaign.campaignId"
            control={control}
            render={({ fieldState }) => (
              <Field
                label="Parent campaign"
                error={fieldState.error?.message}
                hint="Only active campaigns from admin setup are listed."
              >
                <Select
                  value={selectedCampaignId}
                  onValueChange={onPickCampaign}
                  disabled={loading || campaigns.length === 0}
                >
                  <SelectTrigger className="w-full max-w-xl">
                    <SelectValue
                      placeholder={
                        loading
                          ? "Loading campaigns…"
                          : campaigns.length === 0
                            ? "No campaigns — create in Admin"
                            : "Select campaign"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.campaign_id} value={campaign.campaign_id}>
                        {campaign.campaign_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />

          {campaigns.length === 0 && !loading ? (
            <Link href="/dashboard/admin/campaign-settings">
              <Button type="button" variant="outline" size="sm">
                Go to Admin → Campaigns
              </Button>
            </Link>
          ) : null}

          {selectedCampaignName ? (
            <p className="text-muted-foreground text-sm">
              Parent campaign:{" "}
              <span className="font-medium text-foreground">{selectedCampaignName}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
