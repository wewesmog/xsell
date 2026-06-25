import type { ColumnRename } from "@/lib/schedule/types"
import { LIST_STATUS, type ListStatus } from "@/lib/lists/status"

const API_BASE = process.env.NEXT_PUBLIC_XSELL_API_BASE_URL ?? "http://localhost:8000"

export type ListSort =
  | "newest"
  | "oldest"
  | "name_asc"
  | "name_desc"
  | "rows_desc"
  | "rows_asc"

export const LIST_SORT_OPTIONS: { value: ListSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name_asc", label: "Name A → Z" },
  { value: "name_desc", label: "Name Z → A" },
  { value: "rows_desc", label: "Most rows" },
  { value: "rows_asc", label: "Fewest rows" },
]

type UploadResponse = {
  list_id: string
  file_name: string
  status: typeof LIST_STATUS.pending
}

type CleanResponse = {
  list_id: string
  status: typeof LIST_STATUS.processing
  raw_count: number
  clean_count: number
  duplicate_count: number
}

type ApproveResponse = {
  list_id: string
  status: typeof LIST_STATUS.ready
  raw_count: number
  clean_count: number
  duplicate_count: number
}

type PreviewResponse = {
  file_name: string
  headers: string[]
  preview_rows: Record<string, string>[]
  row_count: number
}

export async function previewListFile(file: File): Promise<PreviewResponse> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch(`${API_BASE}/api/lists/preview`, {
    method: "POST",
    body: form,
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || "Preview failed")
  }
  return (await res.json()) as PreviewResponse
}

export async function uploadListFile(params: {
  file: File
  listName: string
  msisdnColumn: string
  nameColumn: string
  columnRenames: ColumnRename[]
  uploadedBy?: string
}): Promise<UploadResponse> {
  const form = new FormData()
  form.append("file", params.file)
  form.append("list_name", params.listName)
  form.append("uploaded_by", params.uploadedBy ?? "frontend-user")
  form.append(
    "mapping_json",
    JSON.stringify({
      msisdnColumn: params.msisdnColumn,
      nameColumn: params.nameColumn,
      columnRenames: params.columnRenames,
    })
  )

  const res = await fetch(`${API_BASE}/api/lists/upload`, {
    method: "POST",
    body: form,
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || "Upload failed")
  }
  return (await res.json()) as UploadResponse
}

export async function cleanListFile(params: {
  listId: string
  listName?: string
  msisdnColumn?: string
  nameColumn?: string
  columnRenames?: ColumnRename[]
}): Promise<CleanResponse> {
  const form = new FormData()
  if (params.listName) form.append("list_name", params.listName)
  form.append(
    "mapping_json",
    JSON.stringify({
      msisdnColumn: params.msisdnColumn ?? "",
      nameColumn: params.nameColumn ?? "",
      columnRenames: params.columnRenames ?? [],
    })
  )

  const res = await fetch(`${API_BASE}/api/lists/${params.listId}/clean`, {
    method: "POST",
    body: form,
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || "Clean failed")
  }
  return (await res.json()) as CleanResponse
}

export async function approveListFile(params: {
  listId: string
  listName?: string
}): Promise<ApproveResponse> {
  const form = new FormData()
  if (params.listName) form.append("list_name", params.listName)

  const res = await fetch(`${API_BASE}/api/lists/${params.listId}/approve`, {
    method: "POST",
    body: form,
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || "Approve failed")
  }
  return (await res.json()) as ApproveResponse
}

export async function cancelListUpload(listId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/lists/${listId}/cancel`, {
    method: "POST",
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || "Cancel failed")
  }
}

export type SavedListSummary = {
  list_id: string
  list_name: string
  uploaded_by: string
  status: typeof LIST_STATUS.ready | typeof LIST_STATUS.archived
  row_count_clean: number
  uploaded_on: string
  updated_on: string
}

export type ListColumnsPayload = {
  list_id: string
  headers: string[]
  numeric_columns: string[]
  msisdn_column: string
  name_column: string
  preview_rows: Record<string, string>[]
}

export async function fetchSavedLists(params?: {
  limit?: number
  includeArchived?: boolean
  search?: string
  sort?: ListSort
}): Promise<SavedListSummary[]> {
  const query = new URLSearchParams()
  if (params?.limit !== undefined) query.set("limit", String(params.limit))
  if (params?.includeArchived) query.set("include_archived", "true")
  if (params?.search?.trim()) query.set("search", params.search.trim())
  if (params?.sort) query.set("sort", params.sort)
  const suffix = query.toString() ? `?${query.toString()}` : ""

  const res = await fetch(`${API_BASE}/api/lists${suffix}`)
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || "Failed to load lists")
  }
  const data = (await res.json()) as { lists: SavedListSummary[] }
  return data.lists
}

export async function fetchListColumns(listId: string): Promise<ListColumnsPayload | null> {
  const res = await fetch(`${API_BASE}/api/lists/${listId}/columns`)
  if (res.status === 404) return null
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || "Failed to load list columns")
  }
  return (await res.json()) as ListColumnsPayload
}

export async function fetchListById(listId: string): Promise<SavedListSummary | null> {
  const res = await fetch(`${API_BASE}/api/lists/${listId}/status`)
  if (res.status === 404) return null
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || "Failed to load list")
  }
  const row = (await res.json()) as {
    list_id: string
    list_name: string
    uploaded_by?: string
    status: SavedListSummary["status"]
    row_count_clean: number
    uploaded_on?: string
    updated_on: string
  }
  return {
    list_id: row.list_id,
    list_name: row.list_name,
    uploaded_by: row.uploaded_by ?? "frontend-user",
    status: row.status,
    row_count_clean: row.row_count_clean,
    uploaded_on: row.uploaded_on ?? row.updated_on,
    updated_on: row.updated_on,
  }
}

export type { ListStatus }
