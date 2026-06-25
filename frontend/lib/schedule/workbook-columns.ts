/** Mandatory agent workbook layout — must match backend workbook_columns.py */

export const MANDATORY_WORKBOOK_PREFIX = [
  "Date",
  "Lead ID",
  "Product Name",
  "Agent Name",
  "Dial Attempt #",
] as const

export const MANDATORY_WORKBOOK_SUFFIX = [
  "Connection",
  "Disposition (Outcome)",
  "Outcome comment",
  "Follow-up Action",
  "Follow-up Date",
] as const

export const COMPULSORY_DATA_LABELS = ["Mobile Number"] as const

export const MANDATORY_DROPDOWN_OPTIONS: Record<string, readonly string[]> = {
  Connection: ["Connected", "System Issue", "Unreachable", "Not Answered"],
  "Disposition (Outcome)": [
    "Interested",
    "Not Interested",
    "Voicemail",
    "DND",
    "Call Back",
    "Wrong number",
  ],
}

export const ALL_RESERVED_WORKBOOK_LABELS = [
  ...MANDATORY_WORKBOOK_PREFIX,
  ...MANDATORY_WORKBOOK_SUFFIX,
] as const

export type CustomWorkbookFieldType = "text" | "dropdown" | "number" | "date"

export type CustomWorkbookField = {
  label: string
  fieldType: CustomWorkbookFieldType
  options: string[]
}

export const CUSTOM_FIELD_TYPE_LABELS: Record<CustomWorkbookFieldType, string> = {
  text: "Free text",
  dropdown: "Dropdown list",
  number: "Number",
  date: "Date",
}

export function isReservedWorkbookLabel(label: string): boolean {
  const trimmed = label.trim()
  return (ALL_RESERVED_WORKBOOK_LABELS as readonly string[]).includes(trimmed)
}
