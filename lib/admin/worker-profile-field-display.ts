export function formatReferenceDisplay(ref: {
  name?: string | null
  email?: string | null
  phone?: string | null
} | null | undefined): string {
  if (!ref) return "—"
  const parts = [ref.name, ref.email, ref.phone].map((p) => (p ?? "").trim()).filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : "—"
}

export function referenceIsMissing(ref: {
  name?: string | null
  email?: string | null
  phone?: string | null
} | null | undefined): boolean {
  if (!ref) return true
  const name = (ref.name ?? "").trim()
  const email = (ref.email ?? "").trim()
  const phone = (ref.phone ?? "").trim()
  return !name || name === "—" || (!email && !phone)
}
