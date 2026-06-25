"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  duplicateBroadcastApi,
  fetchBroadcasts,
  fetchCampaigns,
  generateBroadcastApi,
  type BroadcastSummary,
  type CampaignSummary,
} from "@/lib/campaigns/api"
import { PageHeader, PageHeaderButton, PageShell } from "@/components/ui/page-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontalIcon } from "lucide-react"

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === "active" ? "default" : "secondary"}>{status}</Badge>
  )
}

export default function CampaignsViewPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [broadcasts, setBroadcasts] = useState<BroadcastSummary[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [campaignRows, broadcastRows] = await Promise.all([
        fetchCampaigns(),
        fetchBroadcasts(),
      ])
      setCampaigns(campaignRows)
      setBroadcasts(broadcastRows)
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  async function onGenerate(broadcastId: string) {
    setActionId(broadcastId)
    try {
      await generateBroadcastApi(broadcastId)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate workbooks")
    } finally {
      setActionId(null)
    }
  }

  async function onDuplicate(broadcast: BroadcastSummary) {
    setActionId(broadcast.broadcast_id)
    try {
      const copy = await duplicateBroadcastApi(broadcast.broadcast_id)
      router.push(`/dashboard/campaign/schedule?broadcastId=${copy.broadcast_id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to duplicate broadcast")
      setActionId(null)
    }
  }

  const broadcastsByCampaign = broadcasts.reduce<Record<string, BroadcastSummary[]>>(
    (acc, b) => {
      acc[b.campaign_id] = acc[b.campaign_id] ?? []
      acc[b.campaign_id].push(b)
      return acc
    },
    {}
  )

  return (
    <PageShell>
      <PageHeader
        title="Campaigns & broadcasts"
        description="View schedule runs and generate agent workbooks. Create campaigns under Admin."
        action={
          <Link href="/dashboard/campaign/schedule">
            <PageHeaderButton type="button">New broadcast</PageHeaderButton>
          </Link>
        }
      />

      {error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : null}

      <Card className="card-accent">
        <CardHeader>
          <CardTitle>All campaigns & broadcasts</CardTitle>
          <CardDescription>
            {loading
              ? "Loading…"
              : `${campaigns.length} campaign(s), ${broadcasts.length} broadcast(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : campaigns.length === 0 ? (
            <p className="text-muted-foreground text-sm">No campaigns yet.</p>
          ) : (
            campaigns.map((campaign) => (
              <div key={campaign.campaign_id} className="rounded-lg border border-border/80 bg-muted/20 p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{campaign.campaign_name}</p>
                  <StatusBadge status={campaign.status} />
                  <Badge variant="outline">{campaign.broadcast_count} broadcast(s)</Badge>
                </div>
                {campaign.description ? (
                  <p className="text-muted-foreground mt-1 text-xs">{campaign.description}</p>
                ) : null}

                <div className="mt-4 grid gap-2 border-t pt-3">
                  <p className="text-muted-foreground text-xs font-medium uppercase">
                    Broadcasts
                  </p>
                  {(broadcastsByCampaign[campaign.campaign_id] ?? []).length === 0 ? (
                    <p className="text-muted-foreground text-sm">No broadcasts yet.</p>
                  ) : (
                    (broadcastsByCampaign[campaign.campaign_id] ?? []).map((broadcast) => (
                      <div
                        key={broadcast.broadcast_id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2.5 shadow-sm"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{broadcast.broadcast_name}</p>
                            <StatusBadge status={broadcast.status} />
                            {broadcast.generated_at ? (
                              <Badge variant="outline" className="text-xs">
                                generated
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground text-xs">
                            {broadcast.schedule_dates.length} day(s) ·{" "}
                            {broadcast.pool_size.toLocaleString()} in pool
                            {broadcast.output_dir ? ` · ${broadcast.output_dir}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actionId === broadcast.broadcast_id}
                            onClick={() => void onGenerate(broadcast.broadcast_id)}
                          >
                            {actionId === broadcast.broadcast_id ? "Working…" : "Generate"}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button size="sm" variant="ghost" type="button">
                                  <MoreHorizontalIcon className="size-4" />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(
                                    `/dashboard/campaign/schedule?broadcastId=${broadcast.broadcast_id}`
                                  )
                                }
                              >
                                Edit schedule
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void onDuplicate(broadcast)}>
                                Duplicate (_copy)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => void onGenerate(broadcast.broadcast_id)}
                              >
                                Generate workbooks
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </PageShell>
  )
}
