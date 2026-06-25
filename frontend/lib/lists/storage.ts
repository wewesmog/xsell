"use client"

import type { ColumnRename } from "@/lib/schedule/types"

const LISTS_STORAGE_KEY = "xsell-ingested-lists-v1"

export type IngestedList = {
  id: string
  name: string
  createdAt: string
  fileName: string
  rowCount: number
  headers: string[]
  previewRows: Record<string, string>[]
  msisdnColumn: string
  nameColumn: string
  columnRenames: ColumnRename[]
}

export function loadIngestedLists(): IngestedList[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(LISTS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as IngestedList[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveIngestedLists(lists: IngestedList[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(LISTS_STORAGE_KEY, JSON.stringify(lists))
}

export function clearIngestedLists() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(LISTS_STORAGE_KEY)
}

export function upsertIngestedList(list: IngestedList) {
  const current = loadIngestedLists()
  const without = current.filter((l) => l.id !== list.id && l.name !== list.name)
  saveIngestedLists([list, ...without])
}
