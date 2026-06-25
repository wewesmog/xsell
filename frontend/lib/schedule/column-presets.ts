/**
 * Column label matching uses ordered rules: first match wins.
 * Each pattern is checked with header.includes(pattern) — same idea as SQL LIKE '%pattern%'
 * on the uppercased source column name (non-alphanumeric → underscore).
 */

export const COMPULSORY_FIELDS = [
  {
    id: "msisdn" as const,
    label: "Mobile number (MSISDN)",
    displayLabel: "Mobile Number",
    patterns: ["MOBILE_NUMBER", "TELEPHONE", "MOBILE", "MSISDN", "PHNE"],
  },
] as const

/** Optional helper patterns for detecting a likely customer name column. */
export const NAME_COLUMN_PATTERNS = [
  "CUSTOMER_NAME",
  "CUST_NAME",
  "CLIENT_NAME",
  "FULL_NAME",
  "ACCOUNT_NAME",
] as const

/** Canonical workbook headers managers pick from (fintech / CVM oriented). */
export const BUILTIN_LABEL_OPTIONS = [
  "Mobile Number",
  "Customer Name",
  "Days Past Due",
  "Days Since Last Activity",
  "Date of Onboarding",
  "Loan Limit",
  "Outstanding Amount",
  "Total Balance",
  "Arrears",
  "Principal Amount",
  "Installment Amount",
  "Interest Rate",
  "Account Number",
  "Contract ID",
  "Product Code",
  "Product Name",
  "Branch",
  "Segment",
  "Risk Grade",
  "Credit Score",
  "Last Disbursement Date",
  "Last Transaction Date",
  "Total Transaction Count",
  "Email",
  "National ID",
  "Disposition",
  "Campaign Code",
] as const

/**
 * Ordered rules: more specific patterns first so e.g. LOAN_LIMIT wins over LIMIT.
 */
export const COLUMN_LABEL_RULES: readonly {
  label: (typeof BUILTIN_LABEL_OPTIONS)[number] | string
  patterns: readonly string[]
  /** If set, only match when header equals this (after normalize). */
  exactOnly?: boolean
}[] = [
  {
    label: "Mobile Number",
    patterns: [
      "MOBILE_NUMBER",
      "TELEPHONE_NUMBER",
      "TELEPHONE_NUMBE",
      "MSISDN",
      "PHNE_NUM",
      "PHNE",
      "TELEPHONE",
      "MOBILE_NO",
      "MOBILE",
    ],
  },
  {
    label: "Customer Name",
    patterns: ["CUSTOMER_NAME", "CUST_NAME", "CLIENT_NAME", "FULL_NAME", "ACCOUNT_NAME"],
  },
  {
    label: "Days Past Due",
    patterns: ["DAYS_PAST_DUE", "DAYSPASTDUE", "DPD", "DELINQUENCY", "OVERDUE_DAYS"],
  },
  {
    label: "Days Since Last Activity",
    patterns: [
      "DAYS_SINCE_LAST_ACTIVITY",
      "DAYS_SINCE_LAST_TXN",
      "DAYS_SINCE_LAST",
      "LAST_ACTIVITY_DAYS",
      "DAYS_INACTIVE",
      "RECENCY_DAYS",
      "DAYS_SINCE_ACTIVITY",
    ],
  },
  {
    label: "Date of Onboarding",
    patterns: [
      "DATE_OF_ONBOARDING",
      "ONBOARDING_DATE",
      "ONBOARD_DATE",
      "ACCT_OPEN_DATE",
      "ACCOUNT_OPEN_DATE",
      "CUSTOMER_SINCE",
      "REGISTRATION_DATE",
      "OPEN_DATE",
      "ONBOARDING",
    ],
  },
  {
    label: "Loan Limit",
    patterns: [
      "LOAN_LIMIT",
      "CREDIT_LIMIT",
      "CREDITLIMIT",
      "APPROVED_LIMIT",
      "SANCTION_LIMIT",
      "FACILITY_LIMIT",
    ],
  },
  { label: "Loan Limit", patterns: ["LIMIT"], exactOnly: true },
  {
    label: "Outstanding Amount",
    patterns: ["OUTSTANDING_AMOUNT", "OUTSTANDING_BAL", "OUTSTANDING", "OS_BALANCE", "OS_AMT"],
  },
  {
    label: "Total Balance",
    patterns: ["TOTAL_BALANCE", "TOTALBAL", "TOTAL_BAL", "CURRENT_BALANCE"],
  },
  { label: "Arrears", patterns: ["ARREARS", "ARREAR_AMT", "OVERDUE_AMT"] },
  {
    label: "Principal Amount",
    patterns: ["PRINCIPAL_AMT", "PRINCIPLE_AMT", "PRINCIPAL_AMOUNT", "PRINCIPAL_BAL"],
  },
  {
    label: "Installment Amount",
    patterns: ["INSTALLMENT_AMT", "INSTALLMENT_AMOUNT", "EMI", "MONTHLY_INSTALLMENT"],
  },
  {
    label: "Interest Rate",
    patterns: ["INTEREST_RATE", "INT_RATE", "RATE_OF_INTEREST"],
  },
  {
    label: "Account Number",
    patterns: ["ACCOUNT_NUMBER", "ACCT_NO", "ACCOUNT_NO", "ACCOUNT_NUM"],
  },
  {
    label: "Contract ID",
    patterns: ["CONTRACT_ID", "CONTRACT_NO", "LOAN_ID", "FACILITY_ID"],
  },
  { label: "Product Code", patterns: ["PRODUCT_CODE", "PROD_CODE", "SKU_CODE"] },
  { label: "Product Name", patterns: ["PRODUCT_NAME", "PROD_NAME", "PRODUCT_DESC"] },
  { label: "Branch", patterns: ["BRANCH_CODE", "BRANCH_NAME", "BRANCH_ID", "BRANCH"] },
  { label: "Segment", patterns: ["SEGMENT", "CUSTOMER_SEGMENT", "CVM_SEGMENT", "CLUSTER"] },
  { label: "Risk Grade", patterns: ["RISK_GRADE", "RISK_BAND", "RISK_CLASS"] },
  { label: "Credit Score", patterns: ["CREDIT_SCORE", "CRB_SCORE", "BUREAU_SCORE"] },
  {
    label: "Last Disbursement Date",
    patterns: ["LAST_DISBURSEMENT", "DISBURSEMENT_DATE", "LAST_DISB_DATE"],
  },
  {
    label: "Last Transaction Date",
    patterns: ["LAST_TXN_DATE", "LAST_TRANSACTION", "LAST_TRAN_DATE", "LAST_ACTIVITY_DATE"],
  },
  {
    label: "Total Transaction Count",
    patterns: ["TOTAL_TXN_COUNT", "TXN_COUNT", "TRANSACTION_COUNT", "TXN_CNT"],
  },
  { label: "Email", patterns: ["EMAIL", "EMAIL_ADDRESS", "E_MAIL"] },
  {
    label: "National ID",
    patterns: ["NATIONAL_ID", "ID_NUMBER", "ID_NO", "NATIONALID", "PASSPORT"],
  },
  { label: "Disposition", patterns: ["DISPOSITION", "LAST_DISPOSITION", "CALL_RESULT"] },
  { label: "Campaign Code", patterns: ["CAMPAIGN_CODE", "CAMP_CODE", "CAMPAIGN_ID"] },
]

const CUSTOM_PRESETS_KEY = "xsell-custom-column-labels"

export function normalizeHeader(header: string): string {
  return header
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

/**
 * Match source column to a preset display label (LIKE-style substring on normalized header).
 */
export function suggestDisplayLabel(sourceHeader: string): string {
  const header = normalizeHeader(sourceHeader)
  if (!header) return sourceHeader

  for (const rule of COLUMN_LABEL_RULES) {
    for (const pattern of rule.patterns) {
      const p = normalizeHeader(pattern)
      if (rule.exactOnly) {
        if (header === p) return rule.label
        continue
      }
      if (header === p || header.includes(p)) {
        return rule.label
      }
    }
  }
  return sourceHeader
}

export function describeColumnMatching(): string {
  return "Presets match when the source column name contains the pattern (case-insensitive), e.g. CUST_DPD → Days Past Due. First matching rule wins; use the text field to override."
}

export function loadCustomLabelPresets(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function saveCustomLabelPreset(label: string) {
  if (typeof window === "undefined") return
  const trimmed = label.trim()
  if (!trimmed) return
  const existing = loadCustomLabelPresets()
  const builtin = BUILTIN_LABEL_OPTIONS as readonly string[]
  if (existing.includes(trimmed) || builtin.includes(trimmed)) return
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify([...existing, trimmed]))
}

export function getAllLabelOptions(): string[] {
  const custom = loadCustomLabelPresets()
  return [...new Set([...BUILTIN_LABEL_OPTIONS, ...custom])]
}

export function getDisplayLabelForColumn(
  sourceHeader: string,
  renames: { sourceHeader: string; displayLabel: string }[]
): string {
  return renames.find((r) => r.sourceHeader === sourceHeader)?.displayLabel ?? sourceHeader
}

/** For compulsory field auto-detect on upload. */
export function guessColumnByPatterns(
  headers: string[],
  patterns: string[]
): string | undefined {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }))
  for (const pattern of patterns) {
    const p = normalizeHeader(pattern)
    const hit = normalized.find(
      (h) => h.norm === p || h.norm.includes(p) || p.includes(h.norm)
    )
    if (hit) return hit.raw
  }
  return undefined
}
