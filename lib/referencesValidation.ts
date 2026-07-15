/** Default minimum references when step metadata.min_count is unset. */
export const MIN_COMPLETE_REFERENCES = 1

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

export type ReferenceRow = {
  first: string
  last: string
  phone: string
  email: string
  relationship?: string
  company?: string
  jobTitle?: string
  yearsKnown?: string
  notes?: string
}

export function emptyReferenceRow(): ReferenceRow {
  return {
    first: "",
    last: "",
    phone: "",
    email: "",
    relationship: "",
    company: "",
    jobTitle: "",
    yearsKnown: "",
    notes: "",
  }
}

const REQUIRED_FIELDS: Array<keyof ReferenceRow> = [
  "first",
  "last",
  "phone",
  "email",
  "relationship",
  "company",
  "jobTitle",
]

function fieldValue(r: ReferenceRow, key: keyof ReferenceRow): string {
  return String(r[key] ?? "").trim()
}

export function isReferenceComplete(r: ReferenceRow): boolean {
  if (!REQUIRED_FIELDS.every((key) => fieldValue(r, key))) return false
  if (!EMAIL_RE.test(fieldValue(r, "email"))) return false
  const digits = fieldValue(r, "phone").replace(/\D/g, "")
  if (digits.length < 10) return false
  return true
}

export function countCompleteReferences(refs: ReferenceRow[]): number {
  if (!Array.isArray(refs)) return 0
  return refs.filter(isReferenceComplete).length
}

/** Any field set but not all required fields (user started a row and must finish or clear). */
export function hasPartiallyFilledReference(refs: ReferenceRow[]): boolean {
  return refs.some((r) => {
    const filled = REQUIRED_FIELDS.map((key) => fieldValue(r, key)).filter(Boolean)
    if (filled.length === 0) {
      const optional = [r.yearsKnown, r.notes].map((x) => String(x ?? "").trim()).filter(Boolean)
      return optional.length > 0
    }
    return filled.length < REQUIRED_FIELDS.length || !isReferenceComplete(r)
  })
}

export function getReferenceFieldError(
  r: ReferenceRow,
  field: keyof ReferenceRow
): string | null {
  const value = fieldValue(r, field)
  if (!value) {
    if (field === "yearsKnown" || field === "notes") return null
    return "Required"
  }
  if (field === "email" && !EMAIL_RE.test(value)) {
    return "Enter a valid email address."
  }
  if (field === "phone") {
    const digits = value.replace(/\D/g, "")
    if (digits.length < 10) return "Enter a valid phone number."
  }
  if (field === "yearsKnown") {
    const n = Number(value)
    if (!Number.isFinite(n) || n < 0 || n > 80) {
      return "Enter years known as a number (0–80)."
    }
  }
  return null
}

/** User-facing error when references cannot be saved yet. */
export function getReferencesSaveError(
  refs: ReferenceRow[],
  options?: { minCount?: number }
): string | null {
  const minCount = options?.minCount ?? MIN_COMPLETE_REFERENCES
  if (hasPartiallyFilledReference(refs)) {
    for (const r of refs) {
      for (const field of REQUIRED_FIELDS) {
        const err = getReferenceFieldError(r, field)
        if (err && fieldValue(r, "first") + fieldValue(r, "last") + fieldValue(r, "email")) {
          if (field === "email" || field === "phone") return err
        }
      }
    }
    return "Complete all required fields for each reference you started, or clear the row."
  }
  const completeCount = countCompleteReferences(refs)
  if (completeCount < minCount) {
    if (minCount === 1) return "Add at least one complete reference to continue."
    return `Add at least ${minCount} complete references to continue.`
  }
  return null
}

export function parseReferenceRowsFromLocalStorage(raw: string | null): ReferenceRow[] {
  if (!raw?.trim()) return []
  try {
    const p = JSON.parse(raw) as unknown
    if (!Array.isArray(p)) return []
    return p.map((row) => {
      const r = row as Partial<ReferenceRow>
      return {
        ...emptyReferenceRow(),
        first: String(r.first ?? ""),
        last: String(r.last ?? ""),
        phone: String(r.phone ?? ""),
        email: String(r.email ?? ""),
        relationship: String(r.relationship ?? ""),
        company: String(r.company ?? ""),
        jobTitle: String(r.jobTitle ?? ""),
        yearsKnown: String(r.yearsKnown ?? ""),
        notes: String(r.notes ?? ""),
      }
    })
  } catch {
    return []
  }
}

/** Uses saved `referenceData` (set when references are saved from the references step). */
export function countCompleteReferencesFromStorage(): number {
  if (typeof window === "undefined") return 0
  return countCompleteReferences(
    parseReferenceRowsFromLocalStorage(localStorage.getItem("referenceData")),
  )
}
