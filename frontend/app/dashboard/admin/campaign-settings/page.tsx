"use client"

import { useCallback, useEffect, useState } from "react"
import {
  createCampaignApi,
  deleteCampaignApi,
  fetchCampaigns,
  updateCampaignApi,
  type CampaignSummary,
  type EntityStatus,
} from "@/lib/campaigns/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function StatusBadge({ status }: { status: EntityStatus }) {
  return (
    <Badge variant={status === "active" ? "default" : "secondary"}>{status}</Badge>
  )
}

export default function CampaignSettingsPage() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null)
  const [editCampaignName, setEditCampaignName] = useState("")
  const [editCampaignDescription, setEditCampaignDescription] = useState("")

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      setCampaigns(await fetchCampaigns())
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load campaigns")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  async function onCreate() {
    if (!name.trim()) {
      setError("Campaign name is required")
      return
    }
    try {
      setSaving(true)
      await createCampaignApi({ campaignName: name, description })
      setName("")
      setDescription("")
      setError("")
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create campaign")
    } finally {
      setSaving(false)
    }
  }

  async function onUpdateCampaign(campaign: CampaignSummary) {
    try {
      await updateCampaignApi(campaign.campaign_id, {
        campaignName: editCampaignName,
        description: editCampaignDescription,
      })
      setEditingCampaignId(null)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update campaign")
    }
  }

  async function onCampaignStatus(campaignId: string, status: EntityStatus) {
    try {
      await updateCampaignApi(campaignId, { status })
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status")
    }
  }

  async function onDeleteCampaign(campaignId: string) {
    if (!window.confirm("Delete this campaign and all its broadcasts?")) return
    try {
      await deleteCampaignApi(campaignId)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete campaign")
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Campaign setup</CardTitle>
          <CardDescription>
            Create and manage parent campaigns. Broadcast schedules are built under Campaign →
            Schedule.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid max-w-2xl gap-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Campaign name"
            disabled={saving}
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Description (optional)"
            disabled={saving}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void onCreate()} disabled={saving || !name.trim()}>
              {saving ? "Creating…" : "Create campaign"}
            </Button>
            {error ? <p className="text-destructive text-xs">{error}</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All campaigns</CardTitle>
          <CardDescription>
            {loading ? "Loading…" : `${campaigns.length} campaign(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : campaigns.length === 0 ? (
            <p className="text-muted-foreground text-sm">No campaigns created yet.</p>
          ) : (
            campaigns.map((campaign) => (
              <div
                key={campaign.campaign_id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-4"
              >
                <div className="min-w-0 flex-1">
                  {editingCampaignId === campaign.campaign_id ? (
                    <div className="grid gap-2">
                      <Input
                        value={editCampaignName}
                        onChange={(e) => setEditCampaignName(e.target.value)}
                      />
                      <Textarea
                        value={editCampaignDescription}
                        onChange={(e) => setEditCampaignDescription(e.target.value)}
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => void onUpdateCampaign(campaign)}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingCampaignId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground">
                        {campaign.campaign_name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StatusBadge status={campaign.status} />
                        <Badge variant="outline">
                          {campaign.broadcast_count} broadcast(s)
                        </Badge>
                      </div>
                      {campaign.description ? (
                        <p className="text-muted-foreground mt-1 text-xs">
                          {campaign.description}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
                {editingCampaignId !== campaign.campaign_id ? (
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={campaign.status}
                      onValueChange={(v) =>
                        void onCampaignStatus(campaign.campaign_id, v as EntityStatus)
                      }
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">active</SelectItem>
                        <SelectItem value="inactive">inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingCampaignId(campaign.campaign_id)
                        setEditCampaignName(campaign.campaign_name)
                        setEditCampaignDescription(campaign.description)
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => void onDeleteCampaign(campaign.campaign_id)}
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
