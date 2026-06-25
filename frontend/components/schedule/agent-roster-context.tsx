"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { fetchRoster, toRosterEntry, type RosterEntry } from "@/lib/agents/api"

type RosterContextValue = {
  roster: RosterEntry[]
  loading: boolean
  error: string
  refresh: (window?: { from?: string; to?: string }) => Promise<void>
}

const AgentRosterContext = createContext<RosterContextValue>({
  roster: [],
  loading: true,
  error: "",
  refresh: async () => {},
})

export function AgentRosterProvider({ children }: { children: React.ReactNode }) {
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const refresh = useCallback(async (window?: { from?: string; to?: string }) => {
    setLoading(true)
    try {
      const rows = await fetchRoster({
        activeOnly: true,
        from: window?.from,
        to: window?.to,
      })
      setRoster(rows.map(toRosterEntry))
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load roster")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo(
    () => ({ roster, loading, error, refresh }),
    [roster, loading, error, refresh]
  )

  return (
    <AgentRosterContext.Provider value={value}>{children}</AgentRosterContext.Provider>
  )
}

export function useAgentRoster() {
  return useContext(AgentRosterContext)
}
