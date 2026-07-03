/** Minimum references required before summary / final submit. */
export const MIN_COMPLETE_REFERENCES = 2

export type ReferenceRow = {
  first: string
  last: string
  phone: string
  email: string
}

export function isReferenceComplete(r: ReferenceRow): boolean {
  return Boolean(
    String(r.first ?? "").trim() &&
      String(r.last ?? "").trim() &&
      String(r.phone ?? "").trim() &&
      String(r.email ?? "").trim(),
  )
}

export function countCompleteReferences(refs: ReferenceRow[]): number {
  if (!Array.isArray(refs)) return 0
  return refs.filter(isReferenceComplete).length
}

/** Any field set but not all four (user started a row and must finish or clear). */
export function hasPartiallyFilledReference(refs: ReferenceRow[]): boolean {
  return refs.some((r) => {
    const parts = [r.first, r.last, r.phone, r.email].map((x) => String(x ?? "").trim()).filter(Boolean)
    return parts.length > 0 && parts.length < 4
  })
}

/** User-facing error when references cannot be saved yet. */
export function getReferencesSaveError(refs: ReferenceRow[]): string | null {
  if (hasPartiallyFilledReference(refs)) {
    return "All fields are required."
  }
  const completeCount = countCompleteReferences(refs)
  if (completeCount === 1) {
    return "2 References are necessary, please add more 1 reference"
  }
  if (completeCount < MIN_COMPLETE_REFERENCES) {
    return "All fields are required."
  }
  return null
}

export function parseReferenceRowsFromLocalStorage(raw: string | null): ReferenceRow[] {
  if (!raw?.trim()) return []
  try {
    const p = JSON.parse(raw) as unknown
    return Array.isArray(p) ? (p as ReferenceRow[]) : []
  } catch {
    return []
  }
}

/** Uses saved `referenceData` (set when references are saved from step 5). */
export function countCompleteReferencesFromStorage(): number {
  if (typeof window === "undefined") return 0
  return countCompleteReferences(
    parseReferenceRowsFromLocalStorage(localStorage.getItem("referenceData")),
  )
}
