"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { CheckIcon, SearchIcon } from "lucide-react"
import {
  fetchListById,
  fetchSavedLists,
  LIST_SORT_OPTIONS,
  type ListSort,
  type SavedListSummary,
} from "@/lib/lists/api"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type ListPickerProps = {
  value: string
  onSelect: (list: SavedListSummary) => void
  autoSelectLatest?: boolean
  /** Hide lists already chosen elsewhere (e.g. lead list or other exclusion lists). */
  excludeIds?: string[]
}

function formatListDate(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function ListPicker({
  value,
  onSelect,
  autoSelectLatest = false,
  excludeIds = [],
}: ListPickerProps) {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [sort, setSort] = useState<ListSort>("newest")
  const [lists, setLists] = useState<SavedListSummary[]>([])
  const [pinnedList, setPinnedList] = useState<SavedListSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const autoSelectedRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchSavedLists({ search: debouncedSearch || undefined, sort, limit: 100 })
      .then((rows) => {
        if (cancelled) return
        setLists(rows)
        setError("")
        if (autoSelectLatest && !autoSelectedRef.current && rows.length > 0) {
          autoSelectedRef.current = true
          onSelect(rows[0])
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : "Failed to load lists"
        setError(message)
        setLists([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedSearch, sort, autoSelectLatest, onSelect])

  useEffect(() => {
    if (!value) {
      setPinnedList(null)
      return
    }
    const inResults = lists.some((l) => l.list_id === value)
    if (inResults) {
      setPinnedList(null)
      return
    }
    let cancelled = false
    void fetchListById(value)
      .then((row) => {
        if (!cancelled) setPinnedList(row)
      })
      .catch(() => {
        if (!cancelled) setPinnedList(null)
      })
    return () => {
      cancelled = true
    }
  }, [value, lists])

  const displayLists =
    pinnedList && !lists.some((l) => l.list_id === pinnedList.list_id)
      ? [pinnedList, ...lists]
      : lists

  const excludeSet = new Set(excludeIds)
  const selectableLists = displayLists.filter((l) => !excludeSet.has(l.list_id))

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-[1fr_200px]">
        <div className="grid gap-1">
          <Label htmlFor="list-search">Search lists</Label>
          <div className="relative">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              id="list-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by list name…"
              className="pl-9"
            />
          </div>
        </div>
        <div className="grid gap-1">
          <Label>Sort by</Label>
          <Select value={sort} onValueChange={(v) => setSort((v ?? "newest") as ListSort)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIST_SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <ScrollArea className="h-[280px] rounded-md border">
        <div className="grid gap-1 p-2">
          {loading ? (
            <p className="text-muted-foreground p-3 text-sm">Loading lists…</p>
          ) : selectableLists.length === 0 ? (
            <div className="text-muted-foreground p-3 text-sm">
              <p>
                {debouncedSearch
                  ? "No lists match your search."
                  : excludeIds.length > 0
                    ? "All matching lists are already selected."
                    : "No approved lists yet."}
              </p>
              {!debouncedSearch && excludeIds.length === 0 ? (
                <Link href="/dashboard/campaign/lists" className="text-primary mt-2 inline-block text-xs underline">
                  Go to list ingestion
                </Link>
              ) : null}
            </div>
          ) : (
            selectableLists.map((list, index) => {
              const selected = list.list_id === value
              const isLatest = sort === "newest" && index === 0 && !debouncedSearch
              return (
                <button
                  key={list.list_id}
                  type="button"
                  onClick={() => onSelect(list)}
                  className={cn(
                    "hover:bg-muted/60 flex w-full items-start justify-between gap-3 rounded-md border p-3 text-left transition-colors",
                    selected ? "border-primary bg-primary/5" : "border-transparent"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{list.list_name}</p>
                      {isLatest ? <Badge variant="secondary">Latest</Badge> : null}
                      {selected ? <Badge>Selected</Badge> : null}
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {list.row_count_clean.toLocaleString()} rows · {formatListDate(list.uploaded_on)}
                    </p>
                  </div>
                  {selected ? (
                    <CheckIcon className="text-primary mt-0.5 size-4 shrink-0" />
                  ) : null}
                </button>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
