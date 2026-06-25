"use client"

import { useCallback, useEffect, useState } from "react"
import {
  createAbsenceApi,
  deleteAbsenceApi,
  fetchAbsences,
  fetchAgents,
  type AgentSummary,
  type RosterAbsence,
} from "@/lib/agents/api"
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

export default function RosterPage() {
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [absences, setAbsences] = useState<RosterAbsence[]>([])
  const [staffNo, setStaffNo] = useState("")
  const [absentDate, setAbsentDate] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [agentRows, absenceRows] = await Promise.all([fetchAgents(), fetchAbsences()])
      setAgents(agentRows)
      setAbsences(absenceRows)
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load roster")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onAdd() {
    if (!staffNo || !absentDate) {
      setError("Select agent and absence date")
      return
    }
    try {
      await createAbsenceApi({ staffNo, absentDate, note })
      setAbsentDate("")
      setNote("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add absence")
    }
  }

  async function onRemove(absenceId: string) {
    try {
      await deleteAbsenceApi(absenceId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove absence")
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Roster absences</CardTitle>
          <CardDescription>
            Mark agents absent on specific dates. Schedule capacity and generation respect these
            entries.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid max-w-2xl gap-4">
          <Select value={staffNo} onValueChange={setStaffNo}>
            <SelectTrigger>
              <SelectValue placeholder="Select agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.staff_no} value={a.staff_no}>
                  {a.staff_no} — {a.staff_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={absentDate}
            onChange={(e) => setAbsentDate(e.target.value)}
          />
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
          />
          <Button onClick={() => void onAdd()}>Record absence</Button>
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming & recorded absences</CardTitle>
          <CardDescription>
            {loading ? "Loading…" : `${absences.length} absence(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : absences.length === 0 ? (
            <p className="text-muted-foreground text-sm">No absences recorded.</p>
          ) : (
            absences.map((row) => (
              <div
                key={row.absence_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {row.staff_no} — {row.staff_name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {row.absent_date}
                    {row.note ? ` · ${row.note}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => void onRemove(row.absence_id)}>
                  Remove
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
