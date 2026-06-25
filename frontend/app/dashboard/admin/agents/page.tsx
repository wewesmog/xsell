"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
  createAgentApi,
  deleteAgentApi,
  fetchAgents,
  updateAgentApi,
  type AgentSummary,
} from "@/lib/agents/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [staffNo, setStaffNo] = useState("")
  const [staffName, setStaffName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setAgents(await fetchAgents())
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load agents")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onCreate() {
    if (!staffNo.trim() || !staffName.trim()) {
      setError("Staff number and name are required")
      return
    }
    try {
      setSaving(true)
      await createAgentApi({ staffNo, staffName })
      setStaffNo("")
      setStaffName("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create agent")
    } finally {
      setSaving(false)
    }
  }

  async function onToggle(agent: AgentSummary) {
    try {
      await updateAgentApi(agent.staff_no, { active: !agent.active })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update agent")
    }
  }

  async function onDelete(staffNo: string) {
    if (!window.confirm(`Remove agent ${staffNo}?`)) return
    try {
      await deleteAgentApi(staffNo)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete agent")
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Agents</CardTitle>
          <CardDescription>
            Master agent table. Schedule reads via <code className="text-xs">GET /api/roster</code>.
            Record absences under{" "}
            <Link href="/dashboard/admin/roster" className="text-primary underline-offset-4 hover:underline">
              Admin → Roster
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="grid max-w-2xl gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={staffNo}
              onChange={(e) => setStaffNo(e.target.value)}
              placeholder="Staff number (e.g. KEN216725)"
              disabled={saving}
            />
            <Input
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="Full name"
              disabled={saving}
            />
          </div>
          <Button onClick={() => void onCreate()} disabled={saving}>
            {saving ? "Adding…" : "Add agent"}
          </Button>
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Roster</CardTitle>
          <CardDescription>
            {loading ? "Loading…" : `${agents.length} agent(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : agents.length === 0 ? (
            <p className="text-muted-foreground text-sm">No agents yet.</p>
          ) : (
            agents.map((agent) => (
              <div
                key={agent.staff_no}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {agent.staff_no} — {agent.staff_name}
                  </p>
                  {agent.absent_dates.length > 0 ? (
                    <p className="text-muted-foreground text-xs">
                      Absent: {agent.absent_dates.join(", ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={agent.active ? "default" : "secondary"}>
                    {agent.active ? "active" : "inactive"}
                  </Badge>
                  <Switch checked={agent.active} onCheckedChange={() => void onToggle(agent)} />
                  <Button size="sm" variant="destructive" onClick={() => void onDelete(agent.staff_no)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
