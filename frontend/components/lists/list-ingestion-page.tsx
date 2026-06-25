"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { buildColumnRenames, parseDelimitedText } from "@/lib/schedule/parse-csv"
import {
  COMPULSORY_FIELDS,
  NAME_COLUMN_PATTERNS,
  guessColumnByPatterns,
} from "@/lib/schedule/column-presets"
import type { ColumnRename } from "@/lib/schedule/types"
import {
  uploadListFile,
  cleanListFile,
  approveListFile,
  cancelListUpload,
  fetchSavedLists,
  previewListFile,
  type SavedListSummary,
} from "@/lib/lists/api"
import { clearIngestedLists } from "@/lib/lists/storage"
import { clearXsellLocalStorage } from "@/lib/app-storage"
import { PageHeader, PageShell } from "@/components/ui/page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { UploadIcon } from "lucide-react"

function defaultListNameFromFileName(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".")
  return lastDot > 0 ? fileName.slice(0, lastDot) : fileName
}

export function ListIngestionPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState("")
  const [listName, setListName] = useState("")
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [loadedRowCount, setLoadedRowCount] = useState(0)
  const [msisdnColumn, setMsisdnColumn] = useState("")
  const [nameColumn, setNameColumn] = useState("")
  const [columnRenames, setColumnRenames] = useState<ColumnRename[]>([])
  const [savedLists, setSavedLists] = useState<SavedListSummary[]>([])
  const [savedListsError, setSavedListsError] = useState("")
  const [pendingListId, setPendingListId] = useState<string | null>(null)
  const [cleanStats, setCleanStats] = useState<{
    raw_count: number
    clean_count: number
    duplicate_count: number
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [statusText, setStatusText] = useState("")

  const loadSavedLists = useCallback(async () => {
    try {
      const lists = await fetchSavedLists({ limit: 5 })
      setSavedLists(lists)
      setSavedListsError("")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load lists"
      setSavedListsError(message)
    }
  }, [])

  useEffect(() => {
    void loadSavedLists()
  }, [loadSavedLists])

  function resetForm(statusMessage = "") {
    setSelectedFile(null)
    setFileName("")
    setListName("")
    setHeaders([])
    setRows([])
    setLoadedRowCount(0)
    setMsisdnColumn("")
    setNameColumn("")
    setColumnRenames([])
    setPendingListId(null)
    setCleanStats(null)
    setStatusText(statusMessage)
    if (fileRef.current) fileRef.current.value = ""
  }

  async function onFile(file: File) {
    if (pendingListId) {
      try {
        await cancelListUpload(pendingListId)
      } catch {
        // ignore stale cancel failures
      }
      setPendingListId(null)
    }
    setCleanStats(null)

    try {
      const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : ""
      const isExcel = ext === ".xlsx" || ext === ".xls"
      let parsedHeaders: string[] = []
      let parsedRows: Record<string, string>[] = []

      let parsedRowCount = 0

      if (isExcel) {
        setStatusText("Reading file...")
        const preview = await previewListFile(file)
        parsedHeaders = preview.headers
        parsedRows = preview.preview_rows
        parsedRowCount = preview.row_count
        setStatusText("")
      } else {
        const text = await file.text()
        const parsed = parseDelimitedText(text)
        parsedHeaders = parsed.headers
        parsedRows = parsed.rows
        parsedRowCount = parsed.rows.length
        if (parsedHeaders.length === 0) {
          setStatusText("Parsing file on server...")
          const preview = await previewListFile(file)
          parsedHeaders = preview.headers
          parsedRows = preview.preview_rows
          parsedRowCount = preview.row_count
          setStatusText("")
        }
      }

      const guessedMsisdn =
        guessColumnByPatterns(parsedHeaders, [...COMPULSORY_FIELDS[0].patterns]) ??
        parsedHeaders[0] ??
        ""
      const guessedName =
        guessColumnByPatterns(parsedHeaders, [...NAME_COLUMN_PATTERNS]) ?? parsedHeaders[1] ?? ""

      setFileName(file.name)
      setSelectedFile(file)
      setListName(defaultListNameFromFileName(file.name))
      setHeaders(parsedHeaders)
      setRows(parsedRows)
      setLoadedRowCount(parsedRowCount)
      setMsisdnColumn(guessedMsisdn)
      setNameColumn(guessedName)
      setColumnRenames(buildColumnRenames(parsedHeaders))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not read file"
      setStatusText(`Error: ${message}`)
    }
  }

  async function discardPending() {
    if (!pendingListId) {
      resetForm()
      return
    }
    try {
      setBusy(true)
      await cancelListUpload(pendingListId)
      clearIngestedLists()
      clearXsellLocalStorage({ keepColumnLabelPresets: true })
      resetForm("Upload canceled")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cancel failed"
      setStatusText(`Error: ${message}`)
    } finally {
      setBusy(false)
    }
  }

  async function runCleanup() {
    if (!selectedFile || !listName.trim() || headers.length === 0 || loadedRowCount === 0) return
    let stagedId = pendingListId
    try {
      setBusy(true)
      setCleanStats(null)
      if (!stagedId) {
        setStatusText("Staging file...")
        const staged = await uploadListFile({
          file: selectedFile,
          listName: listName.trim(),
          msisdnColumn,
          nameColumn,
          columnRenames,
        })
        stagedId = staged.list_id
        setPendingListId(stagedId)
      }
      setStatusText("Cleaning and deduplicating...")
      const cleaned = await cleanListFile({
        listId: stagedId,
        listName: listName.trim(),
        msisdnColumn,
        nameColumn,
        columnRenames,
      })
      setCleanStats({
        raw_count: cleaned.raw_count,
        clean_count: cleaned.clean_count,
        duplicate_count: cleaned.duplicate_count,
      })
      setStatusText("Review stats below, then approve to save.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed"
      setStatusText(`Error: ${message}`)
      if (stagedId) {
        try {
          await cancelListUpload(stagedId)
        } catch {
          // best-effort cleanup
        }
        setPendingListId(null)
        setCleanStats(null)
      }
    } finally {
      setBusy(false)
    }
  }

  async function approveList() {
    if (!pendingListId || !cleanStats || !listName.trim()) return
    try {
      setBusy(true)
      setStatusText("Approving list...")
      const approved = await approveListFile({
        listId: pendingListId,
        listName: listName.trim(),
      })
      clearIngestedLists()
      clearXsellLocalStorage({ keepColumnLabelPresets: true })
      await loadSavedLists()
      resetForm(
        `Saved: ${approved.clean_count.toLocaleString()} rows (${approved.duplicate_count.toLocaleString()} duplicates removed)`
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed"
      setStatusText(`Error: ${message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="List ingestion"
        description="Upload raw files, map columns, clean duplicates, and save reusable lead lists."
      />
      <div className="grid gap-6">
      <Card className="card-accent">
        <CardHeader>
          <CardTitle>Upload file</CardTitle>
          <CardDescription>CSV, TSV, TXT, DAT, or Excel — column preview before clean.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,.dat,.xlsx,.xls,text/csv,text/tab-separated-values"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onFile(f)
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="upload-dropzone w-full"
          >
            <UploadIcon className="text-muted-foreground size-8" />
            <span className="text-sm font-medium">Choose file (CSV, TSV, TXT, Excel)</span>
            <span className="text-muted-foreground text-xs">{fileName || "No file selected"}</span>
          </button>

          <div className="grid gap-2 md:grid-cols-3">
            <div className="grid gap-1">
              <Label htmlFor="list-name">List name</Label>
              <Input
                id="list-name"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder={fileName ? defaultListNameFromFileName(fileName) : "Name for this list"}
                disabled={!selectedFile}
              />
              <p className="text-muted-foreground text-xs">
                Defaults to the file name; edit before cleanup or approve.
              </p>
            </div>
            <div className="grid gap-1">
              <Label>Phone column</Label>
              <Select value={msisdnColumn} onValueChange={(value) => setMsisdnColumn(value ?? "")}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label>Name column (optional)</Label>
              <Select value={nameColumn} onValueChange={(value) => setNameColumn(value ?? "")}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {columnRenames.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source column</TableHead>
                    <TableHead>Display label</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columnRenames.map((r) => (
                    <TableRow key={r.sourceHeader}>
                      <TableCell className="font-mono text-xs">{r.sourceHeader}</TableCell>
                      <TableCell>
                        <Input
                          value={r.displayLabel}
                          onChange={(e) =>
                            setColumnRenames((prev) =>
                              prev.map((row) =>
                                row.sourceHeader === r.sourceHeader
                                  ? { ...row, displayLabel: e.target.value }
                                  : row
                              )
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {cleanStats ? (
            <div className="bg-muted/40 grid gap-2 rounded-lg border p-4 text-sm">
              <p className="font-medium">Cleanup preview</p>
              <div className="grid gap-1 md:grid-cols-3">
                <p>Raw rows: <span className="font-mono">{cleanStats.raw_count.toLocaleString()}</span></p>
                <p>Clean rows: <span className="font-mono">{cleanStats.clean_count.toLocaleString()}</span></p>
                <p>Duplicates removed: <span className="font-mono">{cleanStats.duplicate_count.toLocaleString()}</span></p>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-sm">
              {loadedRowCount > 0
                ? `${loadedRowCount.toLocaleString()} rows in file`
                : "No rows loaded yet"}
              {pendingListId && !cleanStats ? " · staged" : ""}
              {cleanStats ? " · awaiting approval" : ""}
            </div>
            <div className="flex gap-2">
              {pendingListId || selectedFile ? (
                <Button type="button" variant="outline" onClick={() => void discardPending()} disabled={busy}>
                  Cancel
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => void runCleanup()}
                disabled={busy || loadedRowCount === 0 || !listName.trim()}
              >
                Run cleanup
              </Button>
              <Button
                type="button"
                onClick={() => void approveList()}
                disabled={busy || !cleanStats || !pendingListId}
              >
                Approve & save
              </Button>
            </div>
          </div>
          {statusText ? <p className="text-muted-foreground text-xs">{statusText}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent lists</CardTitle>
          <CardDescription>Latest 5 approved lists (newest first).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {savedListsError ? (
            <p className="text-destructive text-sm">{savedListsError}</p>
          ) : null}
          {savedLists.length === 0 ? (
            <p className="text-muted-foreground text-sm">No saved lists yet.</p>
          ) : (
            savedLists.map((list) => (
              <div key={list.list_id} className="flex items-center justify-between rounded border p-3">
                <div>
                  <p className="font-medium">{list.list_name}</p>
                  <p className="text-muted-foreground text-xs">
                    {list.row_count_clean.toLocaleString()} rows · {new Date(list.uploaded_on).toLocaleString()}
                  </p>
                </div>
                <Badge variant="outline">{list.status}</Badge>
              </div>
            ))
          )}
          <div>
            <Link href="/dashboard/campaign/schedule">
              <Button variant="outline" size="sm">Go to schedule</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
    </PageShell>
  )
}
