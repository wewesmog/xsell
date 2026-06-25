import { guessColumnByPatterns, suggestDisplayLabel } from "./column-presets"

export type ParsedCsv = {
  headers: string[]
  rows: Record<string, string>[]
}

export function parseDelimitedText(text: string): ParsedCsv {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  const head = lines[0]
  const sep = head.includes("\t") && head.split("\t").length > head.split(",").length ? "\t" : ","
  const headers = splitDelimitedLine(head, sep).map((h) => h.trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const cells = splitDelimitedLine(lines[i], sep)
    if (cells.every((c) => !c.trim())) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? "").trim()
    })
    rows.push(row)
  }

  return { headers, rows }
}

/** @deprecated Use parseDelimitedText — kept for callers expecting CSV-only name. */
export function parseCsvText(text: string): ParsedCsv {
  return parseDelimitedText(text)
}

function splitDelimitedLine(line: string, sep: string): string[] {
  if (sep !== ",") {
    return line.split(sep).map((s) => s.trim().replace(/^"|"$/g, ""))
  }
  return splitCsvLine(line)
}

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

export function guessColumn(headers: string[], patterns: string[]): string | undefined {
  return guessColumnByPatterns(headers, patterns)
}

export function buildColumnRenames(
  headers: string[]
): { sourceHeader: string; displayLabel: string; includeInExport: boolean }[] {
  return headers.map((h) => ({
    sourceHeader: h,
    displayLabel: suggestDisplayLabel(h),
    includeInExport: true,
  }))
}
