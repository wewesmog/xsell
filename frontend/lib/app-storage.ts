/**
 * Central cleanup for browser persistence (schedule drafts, legacy list cache, etc.).
 * Lists and broadcasts live in the API / SQLite — not localStorage.
 */

import { STORAGE_KEY } from "@/lib/schedule/constants"

export const XSHELL_STORAGE_KEYS = [
  STORAGE_KEY,
  "xsell-ingested-lists-v1",
  "xsell-custom-column-labels",
] as const

export function clearXsellLocalStorage(options?: { keepColumnLabelPresets?: boolean }) {
  if (typeof window === "undefined") return

  for (const key of XSHELL_STORAGE_KEYS) {
    if (options?.keepColumnLabelPresets && key === "xsell-custom-column-labels") {
      continue
    }
    window.localStorage.removeItem(key)
  }

  for (let i = window.localStorage.length - 1; i >= 0; i--) {
    const key = window.localStorage.key(i)
    if (!key?.startsWith("xsell-")) continue
    if (options?.keepColumnLabelPresets && key === "xsell-custom-column-labels") continue
    window.localStorage.removeItem(key)
  }
}
