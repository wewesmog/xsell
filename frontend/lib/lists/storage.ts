"use client"

/**
 * Legacy localStorage cleanup for pre-API list cache.
 * Lists are persisted in PostgreSQL via the backend API.
 */

const LISTS_STORAGE_KEY = "xsell-ingested-lists-v1"

export function clearIngestedLists() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(LISTS_STORAGE_KEY)
}
