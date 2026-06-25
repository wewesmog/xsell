/** Hardcoded list-ingestion status literals (must match backend migration). */

export const LIST_STATUS = {
  /** Disk-only staging; no DB row yet */
  pending: "pending",
  /** Cleaned in DB; awaiting user approval */
  processing: "processing",
  /** Approved for campaigns */
  ready: "ready",
  /** Soft-disabled; name can be reused */
  archived: "archived",
  /** Canceled staging / unapproved clean */
  canceled: "canceled",
} as const

export type ListStatus = (typeof LIST_STATUS)[keyof typeof LIST_STATUS]

export const ROW_DECISION = {
  pending: "pending",
  keep: "keep",
  drop: "drop",
  merge: "merge",
} as const

export type RowDecision = (typeof ROW_DECISION)[keyof typeof ROW_DECISION]
